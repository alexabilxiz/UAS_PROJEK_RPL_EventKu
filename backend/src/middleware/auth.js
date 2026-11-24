import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { forbidden, unauthorized, wrap } from '../lib/errors.js';
import { USER_SELECT } from '../lib/serializers.js';

async function userFromRequest(req) {
  const header = req.headers.authorization;
  const match = /^Bearer ([^\s]+)$/.exec(header ?? '');
  if (!match) return null;
  let payload;
  try {
    payload = jwt.verify(match[1], config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (typeof payload.jti !== 'string' || typeof payload.sub !== 'string') return null;
  // Sesi dicek ke database agar akun nonaktif atau ganti sandi langsung mencabut token lama.
  const { rows } = await query(
    `${USER_SELECT} JOIN sessions s ON s.user_id = u.id
     WHERE s.jti = $1 AND u.id = $2 AND s.expires_at > $3 AND u.status = 'active'`,
    [payload.jti, payload.sub, new Date()],
  );
  if (!rows.length) return null;
  req.jti = payload.jti;
  return rows[0];
}

/** Wajib login. 401 bila token hilang, salah, kedaluwarsa, atau dicabut. */
export const requireAuth = wrap(async (req, _res, next) => {
  const user = await userFromRequest(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
});

/** Login opsional: token tidak valid diperlakukan sebagai pengunjung. */
export const optionalAuth = wrap(async (req, _res, next) => {
  req.user = (await userFromRequest(req)) ?? undefined;
  next();
});

/** Pakai setelah requireAuth. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.role)) return next(forbidden('Akses memerlukan akun dengan peran yang sesuai.'));
  return next();
};

export function requireVerifiedOrganization(req) {
  if (req.user.organization_status !== 'verified') throw forbidden('Organisasi belum terverifikasi.');
}
