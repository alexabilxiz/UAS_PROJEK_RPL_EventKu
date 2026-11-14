import { describe, expect, it, vi } from 'vitest';
import { listEvents } from './eventService';
import { listMonthEvents } from './calendarService';

vi.mock('./eventService', () => ({ listEvents: vi.fn() }));

describe('calendar API pagination', () => {
  it('loads every page with WIB bounds and forwards cancellation', async () => {
    const signal = new AbortController().signal;
    const events = Array.from({ length: 20 }, (_, i) => ({ eventId: `event-${i}` }));
    listEvents.mockResolvedValueOnce({ data: events, total: 21, page: 1 })
      .mockResolvedValueOnce({ data: [{ eventId: 'last' }], total: 21, page: 2 });
    expect(await listMonthEvents('2035-11', { signal })).toHaveLength(21);
    expect(listEvents).toHaveBeenLastCalledWith({ from: '2035-11-01T00:00:00+07:00', to: '2035-12-01T00:00:00+07:00', page: 2, limit: 20 }, { signal });
  });
  it('does not display an incomplete month after an API error', async () => {
    listEvents.mockResolvedValueOnce({ data: [{ eventId: 'first' }], total: 21, page: 1 })
      .mockRejectedValueOnce(new Error('Offline'));
    await expect(listMonthEvents('2035-11')).rejects.toThrow('Offline');
  });
  it('rejects repeated pages rather than hanging', async () => {
    listEvents.mockResolvedValueOnce({ data: [{ eventId: 'first' }], total: 21, page: 1 })
      .mockResolvedValueOnce({ data: [{ eventId: 'first' }], total: 21, page: 1 });
    await expect(listMonthEvents('2035-11')).rejects.toMatchObject({ status: 502 });
  });
});
