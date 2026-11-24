// Aturan ini sengaja sama dengan frontend/src/utils/events.js dan eventSubmission.js
// supaya data yang lolos form juga lolos di server (dan sebaliknya).

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

export function safeHttpsUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || /[\s\\]/.test(value)) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export const isHttpsPoster = (value) => Boolean(safeHttpsUrl(value));
export const isUploadPoster = (value) => typeof value === 'string'
  && /^\/api\/v1\/assets\/posters\/[a-f0-9-]{36}$/.test(value);
export const isEventPosterReference = (value) => isHttpsPoster(value) || isUploadPoster(value);

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const text = (value) => (typeof value === 'string' ? value.trim() : '');

export const POSTER_LIMIT = 2 * 1024 * 1024;
export const POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function matchesImage(bytes, type) {
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}
