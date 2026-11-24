export class HttpError extends Error {
  constructor(status, message, fieldErrors) {
    super(message);
    this.status = status;
    if (fieldErrors && Object.keys(fieldErrors).length) this.fieldErrors = fieldErrors;
  }
}

export const badRequest = (message = 'Permintaan tidak valid.') => new HttpError(400, message);
export const unauthorized = (message = 'Sesi tidak valid atau sudah berakhir.') => new HttpError(401, message);
export const forbidden = (message = 'Akun Anda tidak memiliki izin untuk tindakan ini.') => new HttpError(403, message);
export const notFound = (message = 'Data tidak ditemukan.') => new HttpError(404, message);
export const conflict = (message = 'Permintaan bertentangan dengan status data saat ini.') => new HttpError(409, message);
export const invalid = (message, fieldErrors) => new HttpError(422, message, fieldErrors);

/** Express 4 tidak menangkap promise rejection, jadi bungkus setiap handler async. */
export const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === 'string' && UUID.test(value);

/** ID bukan UUID pasti tidak ada; jawab 404 agar PostgreSQL tidak melempar error cast. */
export function uuidOr404(value, message) {
  if (!isUuid(value)) throw notFound(message);
  return value.toLowerCase();
}
