import { query } from '../db.js';
import { invalid } from './errors.js';
import { isEventPosterReference, isEventTimestamp, isUploadPoster, safeHttpsUrl, text } from './validators.js';

const MAX_QUOTA = 100_000;

/**
 * Validasi body event (pengajuan maupun penyuntingan) dan ubah ke kolom database.
 * `current` diisi saat menyunting: kategori nonaktif yang sudah dipakai event tetap boleh.
 */
export async function parseEventInput(body, { organizationId, current } = {}) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};
  const title = text(input.title);
  const description = text(input.description);
  const locationOrLink = text(input.locationOrLink);
  const external = input.registrationMode === 'external';
  const audience = text(input.audience);
  const registrationUrl = safeHttpsUrl(typeof input.registrationUrl === 'string' ? input.registrationUrl.trim() : '');
  const posterUrl = typeof input.posterUrl === 'string' ? input.posterUrl.trim() : '';

  if (!title || title.length > 200) errors.title = 'Judul wajib diisi (maksimal 200 karakter).';
  if (!description) errors.description = 'Deskripsi wajib diisi.';
  if (!locationOrLink || locationOrLink.length > 500) errors.locationOrLink = 'Lokasi atau tautan wajib diisi (maksimal 500 karakter).';

  let categoryId = null;
  if (typeof input.categoryId === 'string') {
    const { rows } = await query(`SELECT id, is_active FROM categories WHERE id = $1`, [input.categoryId]).catch(() => ({ rows: [] }));
    if (rows.length && (rows[0].is_active || rows[0].id === current?.category_id)) categoryId = rows[0].id;
  }
  if (!categoryId) errors.categoryId = 'Pilih kategori yang aktif.';

  const startValid = isEventTimestamp(input.startAt);
  const endValid = isEventTimestamp(input.endAt);
  if (!startValid || !(Date.parse(input.startAt) > Date.now())) errors.startAt = 'Waktu mulai harus valid dan setelah sekarang.';
  if (!endValid) errors.endAt = 'Waktu selesai tidak valid.';
  else if (startValid && !(Date.parse(input.endAt) > Date.parse(input.startAt))) errors.endAt = 'Waktu selesai harus setelah waktu mulai.';

  if (!isEventPosterReference(posterUrl)) errors.posterUrl = 'Poster harus berupa unggahan atau URL HTTPS.';
  else if (isUploadPoster(posterUrl)) {
    const posterId = posterUrl.split('/').at(-1);
    const { rows } = await query(`SELECT organization_id FROM posters WHERE id = $1`, [posterId]);
    if (!rows.length || rows[0].organization_id !== organizationId) errors.posterUrl = 'Poster unggahan tidak ditemukan.';
  }

  let quota = null;
  if (external) {
    if (!audience) errors.audience = 'Jelaskan siapa yang boleh mengikuti event.';
    if (!registrationUrl) errors.registrationUrl = 'Tautan pendaftaran HTTPS tidak valid.';
  } else if (!Number.isSafeInteger(input.quota) || input.quota < 1 || input.quota > MAX_QUOTA) {
    errors.quota = 'Kuota harus bilangan bulat lebih dari nol.';
  } else {
    quota = input.quota;
  }

  if (Object.keys(errors).length) throw invalid('Data event belum lengkap.', errors);
  return {
    title, description, categoryId, locationOrLink, posterUrl,
    startAt: new Date(input.startAt), endAt: new Date(input.endAt),
    registrationMode: external ? 'external' : 'internal',
    audience,
    registrationUrl: external ? registrationUrl : '',
    quota,
  };
}
