import apiClient, { ApiError } from './apiClient';
import { isEventSubmissionId } from '../utils/eventSubmission';

const eventStatuses = new Set([
  'draft', 'menunggu_moderasi', 'disetujui', 'ditolak', 'selesai', 'dibatalkan',
]);

function contractError() {
  return new ApiError('Respons pengajuan event tidak sesuai kontrak API.', { status: 502 });
}

function eventIdFrom(value) {
  const id = typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? String(value)
    : value;
  if (!isEventSubmissionId(id)) throw contractError();
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
