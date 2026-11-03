import apiClient, { ApiError } from './apiClient';

const ROLES = ['mahasiswa', 'penyelenggara', 'admin'];
const PUBLIC_ROLES = ['mahasiswa', 'penyelenggara'];
const id = (value) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
};
const string = (value) => typeof value === 'string' ? value.trim() : '';
const contractError = () => new ApiError('Respons autentikasi tidak sesuai kontrak. Hubungi pengelola aplikasi.', { status: 502 });

/** Keep identities opaque. The backend has not finalized UUID versus BIGINT. */
export function normalizeUser(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || !id(payload.userId) || !ROLES.includes(payload.role)) throw contractError();
  const organization = payload.organization && typeof payload.organization === 'object'
    ? payload.organization : null;
  return {
    userId: id(payload.userId),
    name: string(payload.name),
    email: string(payload.email),
    role: payload.role,
    status: string(payload.status),
    organizationId: id(payload.organizationId ?? organization?.organizationId ?? organization?.id),
    organizationStatus: string(payload.organizationStatus ?? organization?.status),
  };
}

export function createAuthService(client = apiClient) {
  return {
    async login(email, password, { signal } = {}) {
      const result = await client.request('/auth/login', {
        method: 'POST', body: { email: string(email), password }, signal,
      });
      if (typeof result?.accessToken !== 'string' || !result.accessToken || /\s/.test(result.accessToken)) {
        throw contractError();
      }
      return { accessToken: result.accessToken, user: normalizeUser(result.user) };
    },
    async register({ name, email, password, role, organizationId } = {}, { signal } = {}) {
      const fieldErrors = {};
      if (!string(name)) fieldErrors.name = 'Masukkan nama Anda.';
      if (!string(email)) fieldErrors.email = 'Masukkan email Anda.';
      if (typeof password !== 'string' || password.length < 8) fieldErrors.password = 'Kata sandi minimal 8 karakter.';
      if (!PUBLIC_ROLES.includes(role)) fieldErrors.role = 'Pilih peran mahasiswa atau penyelenggara.';
      if (role === 'penyelenggara' && !id(organizationId)) fieldErrors.organizationId = 'Masukkan ID organisasi dari pengelola.';
      if (Object.keys(fieldErrors).length) {
        throw new ApiError('Periksa kembali data pendaftaran Anda.', { status: 422, fieldErrors });
      }
      const body = { name: string(name), email: string(email), password, role };
      if (role === 'penyelenggara') body.organizationId = id(organizationId);
      const result = await client.request('/auth/register', { method: 'POST', body, signal });
      if (!result || !id(result.userId) || !PUBLIC_ROLES.includes(result.role)) throw contractError();
      return {
        userId: id(result.userId), role: result.role, status: string(result.status),
        organizationId: id(result.organizationId),
      };
    },
    async getMe(token, { signal } = {}) {
      if (typeof token !== 'string' || !token || /\s/.test(token)) {
        throw new ApiError('Sesi tidak valid. Silakan masuk kembali.', { status: 401 });
      }
      const result = await client.request('/auth/me', { token, signal });
      return normalizeUser(result?.user ?? result);
    },
  };
}

export const authService = createAuthService();
export default authService;
