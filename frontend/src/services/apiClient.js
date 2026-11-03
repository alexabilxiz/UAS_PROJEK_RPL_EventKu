export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = {}, retryable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.retryable = retryable;
  }
}

const FIELD_MESSAGES = {
  name: 'Periksa kembali nama Anda.',
  email: 'Periksa kembali alamat email Anda.',
  password: 'Periksa kembali kata sandi Anda. Minimal 8 karakter saat mendaftar.',
  role: 'Pilih peran mahasiswa atau penyelenggara.',
  organizationId: 'Periksa kembali ID organisasi Anda.',
};

function invalidConfiguration() {
  return new ApiError('Alamat API belum dikonfigurasi dengan benar. Hubungi pengelola aplikasi.');
}

function normalizeBaseUrl(value) {
  if (typeof value !== 'string' || !value.trim() || /[\\\s]/.test(value)) {
    throw invalidConfiguration();
  }
  const base = value.trim();
  if (base.startsWith('/') && !base.startsWith('//')) {
    if (/[?#]/.test(base) || base.split('/').some((part) => part === '.' || part === '..')) {
      throw invalidConfiguration();
    }
    return base.replace(/\/+$/, '');
  }
  let url;
  try {
    url = new URL(base);
  } catch {
    throw invalidConfiguration();
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!['http:', 'https:'].includes(url.protocol) || (url.protocol === 'http:' && !local)
    || url.username || url.password || url.search || url.hash) {
    throw invalidConfiguration();
  }
  return url.href.replace(/\/+$/, '');
}

function normalizePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')
    || /[\\\s#]/.test(path)) throw invalidConfiguration();
  let decoded;
  try { decoded = decodeURIComponent(path.split('?')[0]); } catch { throw invalidConfiguration(); }
  if (decoded.startsWith('//') || decoded.includes('\\')
    || decoded.split('/').some((part) => part === '.' || part === '..')) throw invalidConfiguration();
  return path;
}

function safeFieldErrors(payload, status) {
  if (status === 409) return { email: 'Email tersebut sudah terdaftar. Gunakan email lain atau masuk.' };
  if (status !== 422 || !payload || typeof payload !== 'object') return {};
  const errors = payload.fieldErrors ?? payload.errors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return {};
  return Object.fromEntries(Object.keys(FIELD_MESSAGES)
    .filter((field) => Object.hasOwn(errors, field))
    .map((field) => [field, FIELD_MESSAGES[field]]));
}

function responseError(status, payload) {
  const message = {
    400: 'Permintaan tidak valid. Periksa kembali data Anda.',
    401: 'Email atau kata sandi salah, atau sesi Anda sudah berakhir. Silakan masuk kembali.',
    403: 'Akun Anda tidak memiliki izin untuk melakukan tindakan ini.',
    404: 'Layanan yang diminta tidak ditemukan. Hubungi pengelola aplikasi.',
    409: 'Data tersebut sudah digunakan. Periksa kembali data pendaftaran Anda.',
    422: 'Ada data yang belum sesuai. Periksa kembali formulir Anda.',
    429: 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba kembali.',
  }[status] ?? (status >= 500
    ? 'Layanan sedang mengalami gangguan. Silakan coba kembali nanti.'
    : 'Permintaan belum berhasil. Silakan coba kembali.');
  return new ApiError(message, {
    status,
    fieldErrors: safeFieldErrors(payload, status),
    retryable: status === 429 || status >= 500,
  });
}

function cancelled() {
  return new DOMException('Permintaan dibatalkan.', 'AbortError');
}

/** JSON transport only. Session policy belongs to AuthContext, not this client. */
export function createApiClient({ baseUrl = '/api/v1', timeoutMs = 12000, fetchImpl = globalThis.fetch } = {}) {
  // Resolve at request time so a bad deployment config still renders a useful UI error.
  async function request(path, { method = 'GET', body, token, signal } = {}) {
    const base = normalizeBaseUrl(baseUrl);
    const endpoint = normalizePath(path);
    if (typeof fetchImpl !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw invalidConfiguration();
    }
    if (signal?.aborted) throw cancelled();
    if (token !== undefined && (typeof token !== 'string' || !token || /\s/.test(token))) {
      throw new ApiError('Sesi tidak valid. Silakan masuk kembali.', { status: 401 });
    }
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const response = await fetchImpl(`${base}${endpoint}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        credentials: 'omit',
        signal: controller.signal,
      });
      let payload = null;
      if (response.status !== 204) {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.toLowerCase().includes('application/json') || contentType.toLowerCase().includes('+json')) {
          try { payload = await response.json(); } catch { /* Never expose malformed response bodies. */ }
        }
      }
      if (!response.ok) throw responseError(response.status, payload);
      if (response.status === 204) return null;
      if (payload === null) {
        throw new ApiError('Respons layanan tidak sesuai kontrak JSON. Hubungi pengelola aplikasi.', { status: 502 });
      }
      return payload;
    } catch (error) {
      if (signal?.aborted) throw cancelled();
      if (timedOut) {
        throw new ApiError('Layanan terlalu lama merespons. Periksa koneksi lalu coba kembali.', { retryable: true });
      }
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted || error?.name === 'AbortError') throw cancelled();
      throw new ApiError('Tidak dapat menghubungi layanan. Periksa koneksi dan alamat API Anda.', { retryable: true });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  return { request };
}

export const apiClient = createApiClient({ baseUrl: import.meta.env?.VITE_API_BASE_URL || '/api/v1' });
export default apiClient;
