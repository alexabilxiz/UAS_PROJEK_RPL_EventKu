import { isEventDate, isEventTimestamp } from './events';

const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
const monthFormatter = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', year: 'numeric', month: 'long' });

export function wibDate(value = new Date()) {
  return dateFormatter.format(new Date(value));
}

export function validMonth(value) {
  // Leave room for the exclusive upper boundary and previous/next navigation.
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)
    && value >= '1900-01' && value <= '9998-12' && isEventDate(`${value}-01`);
}

export function shiftMonth(month, offset) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function monthRange(month) {
  if (!validMonth(month)) throw new Error('Bulan tidak valid.');
  return { from: `${month}-01T00:00:00+07:00`, to: `${shiftMonth(month, 1)}-01T00:00:00+07:00` };
}

export function monthLabel(month) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

export function monthCells(month) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const end = new Date(`${shiftMonth(month, 1)}-01T00:00:00Z`);
  end.setUTCDate(0);
  const days = end.getUTCDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= days ? `${month}-${String(day).padStart(2, '0')}` : null;
  });
}

export function groupCalendarEvents(events, month) {
  const groups = {};
  for (const event of [...events].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.title.localeCompare(b.title))) {
    if (!isEventTimestamp(event.startAt)) continue;
    const date = wibDate(event.startAt);
    if (date.slice(0, 7) !== month) continue;
    (groups[date] ??= []).push(event);
  }
  return groups;
}
