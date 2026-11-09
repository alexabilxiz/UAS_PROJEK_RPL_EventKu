const eventDateFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric',
});
const eventTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function normalizeEventId(value) {
  const id = typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? String(value) : typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(id) ? id : '';
}

export function isEventDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}

export function isEventTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    && isEventDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

export function formatEventDate(value) {
  return isEventTimestamp(value) ? eventDateFormatter.format(new Date(value)) : 'Jadwal belum tersedia';
}

export function formatEventTime(value) {
  return isEventTimestamp(value) ? `${eventTimeFormatter.format(new Date(value))} WIB` : '';
}

export function safeEventLink(value) {
  if (typeof value !== 'string' || /[\s\\]/.test(value)) return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function safeEventPoster(value) {
  if (typeof value !== 'string' || /[\s\\]/.test(value)) return '';
  if (/^\/(?!\/)/.test(value)) return value;
  const url = safeEventLink(value);
  return url.startsWith('https://') ? url : '';
}

export function safeRegistrationUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value)) return '';
  const url = safeEventLink(value);
  return url.startsWith('https://') ? url : '';
}
