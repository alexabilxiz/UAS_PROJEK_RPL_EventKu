import { describe, expect, it, vi } from 'vitest';
import { createRegistrationService } from './registrationService';

describe('RSVP across pages', () => {
  it('recognizes an existing registration beyond the first 20', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ registrationId: `reg-${i}`, eventId: `event-${i}`, status: 'aktif' }));
    const request = vi.fn().mockResolvedValueOnce({ data: rows, page: 1, total: 21 })
      .mockResolvedValueOnce({ data: [{ registrationId: 'last', eventId: 'target', status: 'aktif' }], page: 2, total: 21 });
    const service = createRegistrationService({ request });
    expect(await service.hasActiveRegistration('target', { token: 'fixture' })).toBe(true);
    expect(request).toHaveBeenLastCalledWith('/registrations/me?scope=upcoming&page=2&limit=20', { token: 'fixture', signal: undefined });
  });
  it('does not treat cancelled registrations as active', async () => {
    const service = createRegistrationService({ request: vi.fn().mockResolvedValue({ data: [{ registrationId: 'last', eventId: 'target', status: 'dibatalkan' }], page: 1, total: 1 }) });
    expect(await service.hasActiveRegistration('target', { token: 'fixture' })).toBe(false);
  });
  it('rejects a repeated page from an incompatible API', async () => {
    const service = createRegistrationService({ request: vi.fn().mockResolvedValue({ data: [{ registrationId: 'r', eventId: 'other', status: 'aktif' }], page: 1, total: 21 }) });
    await expect(service.hasActiveRegistration('target', { token: 'fixture' })).rejects.toMatchObject({ status: 502 });
  });
});
