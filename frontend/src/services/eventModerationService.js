import apiClient, { ApiError } from './apiClient';
import { normalizeEvent } from './eventService';
import { normalizeEventId } from '../utils/events';

export const MODERATION_PAGE_SIZE = 10;
export const REJECTION_REASON_LIMIT = 500;
const queuePath = '/admin/events/moderation';

function contractError() {
  return new ApiError('Respons moderasi tidak sesuai kontrak API.', { status: 502 });
}

export async function listPendingEvents({ token, page, signal }) {
  const query = new URLSearchParams({ page, limit: MODERATION_PAGE_SIZE });
  const result = await apiClient.request(`${queuePath}?${query}`, { token, signal });
  if (!Array.isArray(result?.data) || !Number.isSafeInteger(result.total) || result.total < 0
      || result.page !== page || result.data.length > MODERATION_PAGE_SIZE) throw contractError();
  const events = result.data.map((event) => {
    const normalized = normalizeEvent(event);
    if (normalized.status !== 'menunggu_moderasi') throw contractError();
    return normalized;
  });
  return { events, total: result.total };
}

export async function moderateEvent(eventId, { status, reason, token, signal }) {
  const id = normalizeEventId(eventId);
  if (!id || !['disetujui', 'ditolak', 'dibatalkan'].includes(status)) throw contractError();
  const result = await apiClient.request(`${queuePath}/${id}`, {
    method: 'PATCH',
    body: { status, ...(status !== 'disetujui' && { reason: reason.trim() }) },
    token,
    signal,
  });
  if (normalizeEventId(result?.eventId) !== id || result.status !== status) throw contractError();
}
