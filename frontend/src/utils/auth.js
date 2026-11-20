import { normalizeEventId } from './events';

export const PUBLIC_ROLES = ['mahasiswa', 'penyelenggara'];
export const ROLE_LABELS = { mahasiswa: 'Mahasiswa', penyelenggara: 'Penyelenggara', admin: 'Admin' };
export const ROLE_PATHS = { mahasiswa: '/mahasiswa', penyelenggara: '/penyelenggara', admin: '/admin' };

// Allow only known internal destinations. Never navigate to a URL from a query parameter.
export function safeReturnPath(value) {
  const fixedPaths = [
    '/dashboard', '/events', '/events/calendar', '/akun/pengaturan',
    '/mahasiswa/pendaftaran', '/mahasiswa/minat', '/mahasiswa/notifikasi', '/mahasiswa/favorit',
    '/penyelenggara/event/ajukan', '/penyelenggara/event', '/penyelenggara/notifikasi', '/penyelenggara/statistik',
    '/admin/moderasi', '/admin/moderasi/riwayat', '/admin/moderasi/tayang', '/admin/organisasi', '/admin/kategori',
    '/admin/pengguna', '/admin/statistik', ...Object.values(ROLE_PATHS),
  ];
  if (fixedPaths.includes(value)) return value;
  if (typeof value === 'string' && value.startsWith('/events/')) {
    const eventId = normalizeEventId(value.slice('/events/'.length));
    if (eventId && value === `/events/${eventId}`) return value;
  }
  const roleEventPath = typeof value === 'string' && (
    /^\/penyelenggara\/event\/([^/]+)\/(?:peserta|kelola)$/.exec(value)
    || /^\/mahasiswa\/ulasan\/([^/]+)$/.exec(value)
  );
  if (roleEventPath && normalizeEventId(roleEventPath[1]) === roleEventPath[1]) return value;
  return '/dashboard';
}

export function validateLogin(values) {
  const errors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Masukkan alamat email yang valid.';
  if (!values.password) errors.password = 'Masukkan kata sandi Anda.';
  return errors;
}

export function validateRegistration(values) {
  const errors = validateLogin(values);
  if (!values.name.trim()) errors.name = 'Masukkan nama lengkap Anda.';
  if (values.password.length < 8) errors.password = 'Kata sandi minimal 8 karakter.';
  if (values.password !== values.confirmPassword) errors.confirmPassword = 'Konfirmasi kata sandi belum sama.';
  if (!PUBLIC_ROLES.includes(values.role)) errors.role = 'Pilih peran mahasiswa atau penyelenggara.';
  if (values.role === 'penyelenggara' && !values.organizationId.trim()) errors.organizationId = 'Masukkan ID organisasi yang diberikan pengelola.';
  return errors;
}

export function validateNewPassword(password, confirmation) {
  if (password.length < 8 || password.length > 128) return 'Kata sandi baru harus 8 sampai 128 karakter.';
  if (password !== confirmation) return 'Konfirmasi kata sandi belum sama.';
  return '';
}
