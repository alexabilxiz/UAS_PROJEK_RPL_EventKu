import apiClient, { ApiError } from './apiClient';
import { normalizeEventId } from '../utils/events';
import { normalizeEvent } from './eventService';
import { isEventPosterReference, POSTER_LIMIT, POSTER_TYPES } from '../utils/eventSubmission';

const eventStatuses = new Set([
  'draft', 'menunggu_moderasi', 'disetujui', 'ditolak', 'selesai', 'dibatalkan',
]);

function contractError() {
  return new ApiError('Respons pengajuan event tidak sesuai kontrak API.', { status: 502 });
}

function eventIdFrom(value) {
  const id = normalizeEventId(value);
  if (!id) throw contractError();
  return id;
}

export async function createEventDraft(payload, { token, signal }) {
  const result = await apiClient.request('/events', { method: 'POST', body: payload, token, signal });
  if (result?.status !== 'draft') throw contractError();
  return eventIdFrom(result.eventId);
}

export async function submitEventDraft(eventId, { token, signal }) {
  const result = await apiClient.request(`/events/${eventIdFrom(eventId)}/submit`, {
    method: 'PATCH', token, signal,
  });
  if (result?.status !== 'menunggu_moderasi') throw contractError();
  return result.status;
}

export async function getEventDraftStatus(eventId, { token, signal }) {
  const result = await apiClient.request(`/events/${eventIdFrom(eventId)}`, { token, signal });
  if (!eventStatuses.has(result?.event?.status)) throw contractError();
  return result.event.status;
}

const organizerPath = (eventId) => `/organizer/events/${eventIdFrom(eventId)}`;

export async function getOrganizerEvent(eventId, options) {
  const result = await apiClient.request(organizerPath(eventId), options);
  const event = normalizeEvent(result?.event);
  if (event.eventId !== eventId || !eventStatuses.has(event.status)) throw contractError();
  const version = result?.event?.version ?? 0;
  if (!Number.isSafeInteger(version) || version < 0) throw contractError();
  return { ...event, version };
}

export async function changeOrganizerEvent(current, action, event, { token, signal }) {
  const result = await apiClient.request(organizerPath(current.eventId), {
    method: 'PATCH', token, signal,
    body: { action, event, expectedStatus: current.status, expectedVersion: current.version },
  });
  if (normalizeEventId(result?.event?.eventId) !== current.eventId
      || !eventStatuses.has(result.event.status)) throw contractError();
}

export async function uploadEventPoster(file, { token, signal }) {
  if (!POSTER_TYPES.includes(file.type) || file.size < 1 || file.size > POSTER_LIMIT) {
    throw new ApiError('Pilih poster JPG, PNG, atau WebP berukuran maksimal 2 MB.', { status: 422 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  const result = await apiClient.request('/assets/posters', { method: 'POST', token, signal, body: {
    type: file.type, data: btoa(binary),
  } });
  if (!isEventPosterReference(result?.posterUrl)) throw contractError();
  return result.posterUrl;
}
