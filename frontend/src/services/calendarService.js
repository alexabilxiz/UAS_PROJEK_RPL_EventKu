import { listEvents } from './eventService';
import { ApiError } from './apiClient';
import { monthRange } from '../utils/calendar';

export async function listMonthEvents(month, { signal } = {}) {
  const range = monthRange(month);
  const events = new Map();
  let previousSize = 0;
  // The API caps a page at 20. Load every page before showing the month so
  // a busy month is never silently truncated to the first catalog page.
  for (let page = 1; page <= 500; page++) {
    const result = await listEvents({ ...range, page, limit: 20 }, { signal });
    if (result.page !== page) throw new ApiError('Halaman kalender tidak sesuai respons layanan.', { status: 502 });
    for (const event of result.data) events.set(event.eventId, event);
    if (page * 20 >= result.total) return [...events.values()];
    if (events.size === previousSize) break;
    previousSize = events.size;
  }
  throw new ApiError('Daftar kalender belum lengkap. Coba lagi atau gunakan pencarian event.', { status: 502 });
}
