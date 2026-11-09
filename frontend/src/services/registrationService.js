import apiClient, { ApiError } from './apiClient';
import { normalizeEventId } from '../utils/events';

const REGISTRATION_STATUSES = ['aktif', 'dibatalkan'];

function contractError() {
  return new ApiError('Respons pendaftaran tidak sesuai kontrak API.', { status: 502 });
}

function requireId(value) {
  const id = normalizeEventId(value);
  if (!id) throw contractError();
  return id;
}

function requireToken(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new ApiError('Masuk dengan akun mahasiswa untuk membuka pendaftaran.', { status: 401 });
  }
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRegistration(row) {
  if (!REGISTRATION_STATUSES.includes(row?.status)) throw contractError();
  const event = row.event ?? row;
  return {
    registrationId: requireId(row.registrationId),
    eventId: requireId(event.eventId ?? row.eventId),
    status: row.status,
    title: text(event.title),
    startAt: text(event.startAt),
    endAt: text(event.endAt),
    locationOrLink: text(event.locationOrLink),
  };
}

export function createRegistrationService(client = apiClient) {
  return {
    async register(eventId, { token, signal } = {}) {
      requireToken(token);
      const result = await client.request(`/events/${requireId(eventId)}/registrations`, {
        method: 'POST', token, signal,
      });
      if (result?.status !== 'aktif') throw contractError();
      return { registrationId: requireId(result.registrationId), status: result.status };
    },

    async cancel(registrationId, { token, signal } = {}) {
      requireToken(token);
      const result = await client.request(`/registrations/${requireId(registrationId)}`, {
        method: 'DELETE', token, signal,
      });
      if (!text(result?.message)) throw contractError();
    },

    async list({ token, scope = 'upcoming', page = 1, signal } = {}) {
      requireToken(token);
      if (!['upcoming', 'history'].includes(scope) || !Number.isSafeInteger(page) || page < 1) {
        throw new ApiError('Pilihan halaman pendaftaran tidak valid.', { status: 422 });
      }
      const query = new URLSearchParams({ scope, page: String(page), limit: '20' });
      const result = await client.request(`/registrations/me?${query}`, { token, signal });
      if (!Array.isArray(result?.data) || !Number.isSafeInteger(result.page) || result.page < 1
        || !Number.isSafeInteger(result.total) || result.total < 0) throw contractError();
      return { data: result.data.map(normalizeRegistration), page: result.page, total: result.total };
    },
  };
}

export const registrationService = createRegistrationService();
