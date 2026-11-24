import apiClient, { ApiError } from './apiClient';
import { normalizeEvent } from './eventService';
import { isEventTimestamp, normalizeEventId } from '../utils/events';
import { ROLE_LABELS } from '../utils/auth';

export const WORKSPACE_PAGE_SIZE = 10;
export const CATEGORY_NAME_LIMIT = 80;
export const ORGANIZATION_LABELS = {
  pending: 'Menunggu verifikasi',
  verified: 'Terverifikasi',
  suspended: 'Ditangguhkan',
};
export const EVENT_STATUS_LABELS = {
  draft: 'Draft',
  menunggu_moderasi: 'Menunggu moderasi',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};

function invalidResponse() {
  return new ApiError('Respons layanan tidak sesuai kontrak API.', { status: 502 });
}

function requiredText(value) {
  if (typeof value !== 'string' || !value.trim()) throw invalidResponse();
  return value.trim();
}

function requiredId(value) {
  const id = normalizeEventId(value);
  if (!id) throw invalidResponse();
  return id;
}

function timestamp(value) {
  if (!isEventTimestamp(value)) throw invalidResponse();
  return value;
}

async function readPage(path, normalize, { token, page, signal, scope }) {
  const query = new URLSearchParams({ page, limit: WORKSPACE_PAGE_SIZE, ...(scope && { scope }) });
  const result = await apiClient.request(`${path}?${query}`, { token, signal });
  if (!Array.isArray(result?.data) || result.page !== page || !Number.isSafeInteger(result.total)
      || result.total < result.data.length || result.data.length > WORKSPACE_PAGE_SIZE) throw invalidResponse();
  return { data: result.data.map(normalize), total: result.total, eventTitle: result.eventTitle };
}

function organization(row) {
  if (!Object.hasOwn(ORGANIZATION_LABELS, row?.status)) throw invalidResponse();
  return { organizationId: requiredId(row.organizationId), name: requiredText(row.name), status: row.status };
}

function category(row) {
  if (typeof row?.isActive !== 'boolean') throw invalidResponse();
  return { categoryId: requiredId(row.categoryId), name: requiredText(row.name), isActive: row.isActive };
}

function notification(row) {
  if (typeof row?.isRead !== 'boolean' || !['disetujui', 'ditolak', 'dibatalkan'].includes(row.status)) throw invalidResponse();
  return {
    notificationId: requiredId(row.notificationId),
    eventId: requiredId(row.eventId),
    title: requiredText(row.title), status: row.status,
    reason: row.status !== 'disetujui' ? requiredText(row.reason) : '',
    createdAt: timestamp(row.createdAt), isRead: row.isRead,
  };
}

function participant(row) {
  return {
    registrationId: requiredId(row?.registrationId), name: requiredText(row.name),
    email: requiredText(row.email), registeredAt: timestamp(row.registeredAt),
  };
}

const participantsPath = (eventId) => `/organizer/events/${requiredId(eventId)}/participants`;

export const STUDENT_NOTICE_LABELS = {
  event_baru: 'Event baru sesuai minat', rsvp: 'Pendaftaran berhasil', jadwal_berubah: 'Jadwal event berubah',
  event_dibatalkan: 'Event dibatalkan', pengingat: 'Pengingat H-1',
};

function noticeDetails(row) {
  if (!Object.hasOwn(STUDENT_NOTICE_LABELS, row?.type)) throw invalidResponse();
  return { notificationId: requiredId(row.notificationId), title: requiredText(row.title),
    createdAt: timestamp(row.createdAt), type: row.type };
}

function studentNotice(row) {
  if (typeof row?.isRead !== 'boolean') throw invalidResponse();
  return { ...noticeDetails(row), eventId: requiredId(row.eventId), isRead: row.isRead };
}

function userRow(row) {
  if (!Object.hasOwn(ROLE_LABELS, row?.role) || !['active', 'disabled'].includes(row.status)) throw invalidResponse();
  return { userId: requiredId(row.userId), name: requiredText(row.name), email: requiredText(row.email), role: row.role, status: row.status };
}

function historyRow(row) {
  if (!['disetujui', 'ditolak', 'dibatalkan'].includes(row?.status)) throw invalidResponse();
  return { historyId: requiredId(row.historyId), title: requiredText(row.title), adminName: requiredText(row.adminName),
    status: row.status, reason: row.status === 'disetujui' ? '' : requiredText(row.reason), moderatedAt: timestamp(row.moderatedAt) };
}

function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw invalidResponse();
  return value;
}

function countRows(rows) {
  if (!Array.isArray(rows)) throw invalidResponse();
  return rows.map((row) => ({ label: requiredText(row?.label), total: count(row?.total) }));
}

function eventReview(result) {
  const title = requiredText(result?.title);
  const review = result.review;
  if (review !== null && (!Number.isInteger(review?.rating) || review.rating < 1 || review.rating > 5
      || typeof review.comment !== 'string')) throw invalidResponse();
  return { title, review };
}

export const workspaceService = {
  organizations: (options) => readPage('/admin/organizations', organization, options),
  categories: (options) => readPage('/admin/categories', category, options),
  notifications: (options) => readPage('/notifications/me', notification, options),
  organizerEvents: (options) => readPage('/organizer/events', normalizeEvent, options),
  favorites: (options) => readPage('/student/favorites', normalizeEvent, options),
  studentNotices: (options) => readPage('/student/notifications', studentNotice, options),
  demoEmail: (options) => readPage('/student/demo-mail', (row) => ({
    ...noticeDetails(row),
    to: requiredText(row.to),
  }), options),
  users: (options) => readPage('/admin/users', userRow, options),
  moderationHistory: (options) => readPage('/admin/events/moderation', historyRow, { ...options, scope: 'history' }),
  publishedEvents: (options) => readPage('/admin/events/moderation', normalizeEvent, { ...options, scope: 'published' }),
  async updateUser(id, status, { token, signal }) {
    const userId = requiredId(id);
    const result = await apiClient.request(`/admin/users/${userId}`, { method: 'PATCH', token, signal, body: { status } });
    if (normalizeEventId(result?.userId) !== userId || result.status !== status) throw invalidResponse();
  },
  async statistics(role, options) {
    const result = await apiClient.request(role === 'admin' ? '/admin/statistics' : '/organizer/statistics', options);
    return role === 'admin' ? {
      users: count(result?.users), events: count(result?.events), registrations: count(result?.registrations),
      categories: countRows(result?.categories), months: countRows(result?.months),
    } : { active: count(result?.active), occupancy: count(result?.occupancy), trend: countRows(result?.trend) };
  },
  async markStudentNotice(id, { token, signal }) {
    const result = await apiClient.request(`/student/notifications/${requiredId(id)}/read`, { method: 'PATCH', token, signal });
    if (result?.isRead !== true) throw invalidResponse();
  },
  async interests({ token, signal }, choices) {
    const result = await apiClient.request('/student/interests', {
      token, signal, ...(choices && { method: 'PUT', body: { categoryIds: choices } }),
    });
    if (!Array.isArray(result?.categoryIds)) throw invalidResponse();
    return result.categoryIds.map(requiredId);
  },
  async emailPreference({ token, signal }, emailEnabled) {
    const result = await apiClient.request('/student/notification-preferences', {
      token, signal, ...(typeof emailEnabled === 'boolean' && { method: 'PUT', body: { emailEnabled } }),
    });
    if (typeof result?.emailEnabled !== 'boolean') throw invalidResponse();
    return result.emailEnabled;
  },
  async favorite(eventId, { token, signal }, saved) {
    const result = await apiClient.request(`/student/favorites/${requiredId(eventId)}`, {
      token, signal, ...(typeof saved === 'boolean' && { method: saved ? 'PUT' : 'DELETE' }),
    });
    if (typeof result?.saved !== 'boolean') throw invalidResponse();
    return result.saved;
  },
  async review(eventId, { token, signal }, review) {
    return eventReview(await apiClient.request(`/student/reviews/${requiredId(eventId)}`, {
      token, signal, ...(review && { method: 'PUT', body: review }),
    }));
  },
  async participants(eventId, options) {
    const result = await readPage(participantsPath(eventId), participant, options);
    return { ...result, eventTitle: requiredText(result.eventTitle) };
  },
  async updateOrganization(id, status, { token, signal }) {
    const organizationId = requiredId(id);
    const result = organization(await apiClient.request(`/admin/organizations/${organizationId}`, {
      method: 'PATCH', token, signal, body: { status },
    }));
    if (result.organizationId !== organizationId || result.status !== status) throw invalidResponse();
  },
  async saveCategory(id, values, { token, signal }) {
    const categoryId = id && requiredId(id);
    const path = categoryId ? `/admin/categories/${categoryId}` : '/admin/categories';
    const result = category(await apiClient.request(path, {
      method: categoryId ? 'PATCH' : 'POST', token, signal,
      body: categoryId ? values : { name: values.name },
    }));
    if (result.name !== values.name || result.isActive !== values.isActive
        || (categoryId && categoryId !== result.categoryId)) throw invalidResponse();
  },
  async markRead(id, { token, signal }) {
    const notificationId = requiredId(id);
    const result = await apiClient.request(`/notifications/me/${notificationId}/read`, { method: 'PATCH', token, signal });
    if (normalizeEventId(result?.notificationId) !== notificationId || result.isRead !== true) throw invalidResponse();
  },
  async exportParticipants(eventId, { token, signal }) {
    const result = await apiClient.request(`${participantsPath(eventId)}?format=csv`, { token, signal });
    if (typeof result?.csv !== 'string' || !result.csv.trim()) throw invalidResponse();
    return result.csv;
  },
};
