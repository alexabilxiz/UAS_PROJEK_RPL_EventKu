import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { query, transaction } from '../db.js';
import { conflict, forbidden, invalid, isUuid, unauthorized, wrap } from '../lib/errors.js';
import { EMAIL_PATTERN, safeHttpsUrl, text } from '../lib/validators.js';
import { USER_SELECT, serializeUser } from '../lib/serializers.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const PUBLIC_ROLES = ['mahasiswa', 'penyelenggara'];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
// Hash palsu agar login email tak dikenal memakan waktu sama dengan email dikenal.
const DUMMY_HASH = bcrypt.hashSync('tidak-dipakai', config.bcryptRounds);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => !config.rateLimitEnabled,
  handler: (_req, res) => res.status(429).json({ message: 'Terlalu banyak percobaan. Coba lagi nanti.' }),
});

const validPassword = (value) => typeof value === 'string' && value.length >= 8 && value.length <= 128;

async function issueToken(userId) {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + config.jwtExpiresInSeconds * 1000);
  await query(`DELETE FROM sessions WHERE user_id = $1 AND expires_at <= $2`, [userId, new Date()]);
  await query(`INSERT INTO sessions (jti, user_id, expires_at) VALUES ($1, $2, $3)`, [jti, userId, expiresAt]);
  return jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256', subject: userId, jwtid: jti, expiresIn: config.jwtExpiresInSeconds,
  });
}

router.post('/register', authLimiter, wrap(async (req, res) => {
  const body = req.body ?? {};
  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  const { role } = body;
  const fieldErrors = {};
  if (!name || name.length > 100) fieldErrors.name = 'Nama wajib diisi (maksimal 100 karakter).';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) fieldErrors.email = 'Email tidak valid.';
  if (!validPassword(body.password)) fieldErrors.password = 'Kata sandi 8 sampai 128 karakter.';
  if (!PUBLIC_ROLES.includes(role)) fieldErrors.role = 'Pilih peran mahasiswa atau penyelenggara.';

  let organizationId = null;
  if (role === 'penyelenggara') {
    const candidate = text(String(body.organizationId ?? ''));
    if (!isUuid(candidate)) fieldErrors.organizationId = 'ID organisasi tidak valid.';
    else {
      const { rows } = await query(`SELECT id, status FROM organizations WHERE id = $1`, [candidate.toLowerCase()]);
      if (!rows.length || rows[0].status === 'suspended') fieldErrors.organizationId = 'Organisasi tidak ditemukan atau ditangguhkan.';
      else organizationId = rows[0].id;
    }
  }
  if (Object.keys(fieldErrors).length) throw invalid('Periksa kembali data pendaftaran Anda.', fieldErrors);

  const existing = await query(`SELECT 1 FROM users WHERE email = $1`, [email]);
  if (existing.rows.length) throw conflict('Email sudah terdaftar.');

  const domain = email.split('@')[1];
  const ukwmsVerified = role === 'mahasiswa' && config.ukwmsEmailDomains.includes(domain);
  const status = role === 'penyelenggara' ? 'pending' : 'active';
  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(body.password, config.bcryptRounds);
  await query(
    `INSERT INTO users (id, name, email, password_hash, role, status, ukwms_verified, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, name, email, passwordHash, role, status, ukwmsVerified, organizationId],
  );
  res.status(201).json({ userId, role, status, organizationId });
}));

router.post('/login', authLimiter, wrap(async (req, res) => {
  const email = text(req.body?.email).toLowerCase();
  const password = req.body?.password;
  if (!email || typeof password !== 'string' || password.length > 128) throw unauthorized('Email atau kata sandi salah.');
  const { rows } = await query(`${USER_SELECT} WHERE u.email = $1`, [email]);
  const user = rows[0];
  const matches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !matches) throw unauthorized('Email atau kata sandi salah.');
  if (user.status === 'pending') throw forbidden('Akun penyelenggara menunggu verifikasi admin.');
  if (user.status !== 'active') throw forbidden('Akun ini dinonaktifkan. Hubungi admin.');
  const accessToken = await issueToken(user.id);
  res.json({ accessToken, user: serializeUser(user) });
}));

router.post('/logout', requireAuth, wrap(async (req, res) => {
  await query(`DELETE FROM sessions WHERE jti = $1 AND user_id = $2`, [req.jti, req.user.id]);
  res.json({ message: 'Berhasil keluar.' });
}));

router.get('/me', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store').json(serializeUser(req.user));
});

router.patch('/me/profile', requireAuth, wrap(async (req, res) => {
  const name = text(req.body?.name);
  const rawPhoto = req.body?.photoUrl;
  const photoUrl = rawPhoto === '' || rawPhoto === undefined || rawPhoto === null ? '' : safeHttpsUrl(rawPhoto);
  const fieldErrors = {};
  if (!name || name.length > 100) fieldErrors.name = 'Nama wajib diisi (maksimal 100 karakter).';
  if (rawPhoto && !photoUrl) fieldErrors.photoUrl = 'URL foto harus HTTPS.';
  if (Object.keys(fieldErrors).length) throw invalid('Periksa nama dan URL foto HTTPS.', fieldErrors);
  await query(`UPDATE users SET name = $1, photo_url = $2 WHERE id = $3`, [name, photoUrl, req.user.id]);
  const { rows } = await query(`${USER_SELECT} WHERE u.id = $1`, [req.user.id]);
  res.json(serializeUser(rows[0]));
}));

router.patch('/me/password', requireAuth, wrap(async (req, res) => {
  const { currentPassword, password } = req.body ?? {};
  const currentOk = typeof currentPassword === 'string' && currentPassword.length <= 128
    && await bcrypt.compare(currentPassword, req.user.password_hash);
  if (!currentOk || !validPassword(password)) {
    throw invalid('Periksa kata sandi lama dan kata sandi baru.', {
      ...(!currentOk && { currentPassword: 'Kata sandi lama salah.' }),
      ...(!validPassword(password) && { password: 'Kata sandi baru 8 sampai 128 karakter.' }),
    });
  }
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  await transaction(async (q) => {
    await q(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, req.user.id]);
    // Perangkat lain harus login ulang; sesi yang sedang dipakai tetap hidup.
    await q(`DELETE FROM sessions WHERE user_id = $1 AND jti <> $2`, [req.user.id, req.jti]);
  });
  res.json({ message: 'Kata sandi berhasil diubah.' });
}));

router.post('/forgot-password', authLimiter, wrap(async (req, res) => {
  const email = text(req.body?.email).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw invalid('Masukkan email yang valid.', { email: 'Email tidak valid.' });
  const { rows } = await query(`SELECT id FROM users WHERE email = $1 AND status = 'active'`, [email]);
  if (rows.length) {
    const token = randomBytes(32).toString('hex');
    await transaction(async (q) => {
      await q(`DELETE FROM password_resets WHERE user_id = $1`, [rows[0].id]);
      await q(
        `INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
        [sha256(token), rows[0].id, new Date(Date.now() + 15 * 60 * 1000)],
      );
    });
    // Belum ada layanan email. Tautan hanya dicetak di log selama pengembangan.
    if (!config.isProduction && !config.isTest) {
      console.log(`[reset-password] ${email}: ${config.frontendUrl}/atur-ulang-kata-sandi?token=${token}`);
    }
  }
  // Jawaban sama untuk email terdaftar maupun tidak (mencegah enumerasi akun).
  res.json({ message: 'Jika akun tersedia, tautan pemulihan akan dikirim.' });
}));

router.post('/reset-password', authLimiter, wrap(async (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !validPassword(password)) {
    throw invalid('Tautan pemulihan atau kata sandi tidak valid.');
  }
  const { rows } = await query(
    `SELECT user_id FROM password_resets WHERE token_hash = $1 AND expires_at > $2`, [sha256(token), new Date()],
  );
  if (!rows.length) throw invalid('Tautan pemulihan atau kata sandi tidak valid.');
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  await transaction(async (q) => {
    await q(`UPDATE users SET password_hash = $1 WHERE id = $2 AND status = 'active'`, [passwordHash, rows[0].user_id]);
    await q(`DELETE FROM password_resets WHERE user_id = $1`, [rows[0].user_id]);
    await q(`DELETE FROM sessions WHERE user_id = $1`, [rows[0].user_id]);
  });
  res.json({ message: 'Kata sandi berhasil diatur ulang.' });
}));

export default router;
