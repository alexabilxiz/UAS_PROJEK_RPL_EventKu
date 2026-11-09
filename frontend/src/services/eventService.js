import apiClient, { ApiError } from './apiClient';
import { isEventDate, isEventTimestamp, normalizeEventId, safeEventPoster } from '../utils/events';

const clean = (value) => typeof value === 'string' ? value.trim() : '';
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const badResponse = () => new ApiError('Respons layanan event tidak sesuai kontrak.', { status: 502 });
const notFound = () => new ApiError('Event tidak ditemukan atau belum tersedia untuk publik.', { status: 404 });

export function normalizeEvent(event) {
  const eventId = normalizeEventId(event?.eventId ?? event?.id);
  const title = clean(event?.title);
  if (!eventId || !title) throw badResponse();

  const quota = count(event.quota);
  const reservedSeats = count(event.reservedSeats);
  const availableSeats = count(event.availableSeats) ?? (quota !== null && reservedSeats !== null
    ? Math.max(0, quota - reservedSeats) : null);

  return {
    eventId,
    title,
    description: clean(event.description),
    categoryId: normalizeEventId(event.categoryId ?? event.category?.categoryId ?? event.category?.id),
    categoryName: clean(event.categoryName ?? event.category?.name),
    organizationId: normalizeEventId(event.organizationId ?? event.organization?.organizationId ?? event.organization?.id),
    organizationName: clean(event.organizationName ?? event.organization?.name),
    startAt: isEventTimestamp(event.startAt) ? event.startAt : '',
    endAt: isEventTimestamp(event.endAt) ? event.endAt : '',
    locationOrLink: clean(event.locationOrLink),
    posterUrl: safeEventPoster(event.posterUrl),
    quota,
    reservedSeats,
    availableSeats,
    status: clean(event.status).toLowerCase(),
  };
}

function eventQuery({ q, category, organizer, date, from, to, page = 1, limit = 9 } = {}) {
  const hasRange = Boolean(from || to);
  const badRange = hasRange && (!isEventTimestamp(from) || !isEventTimestamp(to) || Date.parse(from) >= Date.parse(to));
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 20
    || (date && (!isEventDate(date) || hasRange)) || badRange) {
    throw new ApiError('Periksa kembali tanggal dan halaman pencarian.', { status: 422 });
  }

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  for (const [key, value] of Object.entries({ q, category, organizer, date, from, to })) {
    const text = clean(value);
    if (text) params.set(key, text);
  }
  return params.toString();
}

export async function listCategories({ signal } = {}) {
  const result = await apiClient.request('/categories', { signal });
  if (!Array.isArray(result?.data)) throw badResponse();
  return result.data.filter((item) => item?.isActive !== false).map((item) => {
    const categoryId = normalizeEventId(item?.categoryId ?? item?.id);
    const name = clean(item?.name);
    if (!categoryId || !name) throw badResponse();
    return { categoryId, name };
  });
}

export async function listEvents(filters, { signal } = {}) {
  const result = await apiClient.request(`/events?${eventQuery(filters)}`, { signal });
  if (!Array.isArray(result?.data) || count(result.total) === null || count(result.page) === null || result.page < 1) {
    throw badResponse();
  }
  // Discard explicitly internal statuses even if the public endpoint sends them.
  // A summary without status inherits the public endpoint's approved-only scope.
  const data = result.data
    .filter((event) => event?.status == null || clean(event.status).toLowerCase() === 'disetujui')
    .map((event) => ({ ...normalizeEvent(event), status: 'disetujui' }));
  return { data, total: result.total, page: result.page };
}

export async function getEvent(eventId, { signal } = {}) {
  const id = normalizeEventId(eventId);
  if (!id) throw notFound();
  const result = await apiClient.request(`/events/${encodeURIComponent(id)}`, { signal });
  if (result?.event?.status != null && clean(result.event.status).toLowerCase() !== 'disetujui') throw notFound();
  const event = normalizeEvent(result?.event);
  if (event.eventId !== id) throw badResponse();
  return { ...event, status: 'disetujui' };
}
