import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { safeEventPoster } from '../src/utils/events.js';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scryptSync(password, salt, 64) };
}

export function matchesPassword(password, stored) {
  return typeof password === 'string' && password.length <= 128
    && timingSafeEqual(scryptSync(password, stored.salt, 64), stored.hash);
}

export function accountActions(accounts, sessions) {
  const tokens = new Map();
  function invalidateSessions(user, except) {
    for (const [key, profile] of sessions) {
      if (profile.userId === user.userId && key !== except) sessions.delete(key);
    }
  }

  return async function handle({ path, method, user, authorization, read, json, error }) {
    if (path === '/auth/forgot-password' && method === 'POST') {
      const { email } = (await read()) ?? {};
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        error(422, 'Masukkan email yang valid.');
        return true;
      }
      const account = accounts.get(email.trim().toLowerCase());
      const now = Date.now();
      for (const [token, item] of tokens) if (item.expiresAt <= now || item.account === account) tokens.delete(token);
      const token = randomBytes(32).toString('hex');
      if (account?.user.status === 'active') tokens.set(token, { account, expiresAt: now + 900_000 });
      json(200, { message: 'Jika akun tersedia, tautan pemulihan akan dikirim.', demoResetPath: `/atur-ulang-kata-sandi?token=${token}` });
      return true;
    }
    if (path === '/auth/reset-password' && method === 'POST') {
      const { token, password } = (await read()) ?? {};
      const entry = tokens.get(token);
      if (typeof password !== 'string' || password.length < 8 || password.length > 128
          || !entry || entry.expiresAt <= Date.now() || entry.account.user.status !== 'active') {
        error(422, 'Tautan pemulihan atau kata sandi tidak valid.');
        return true;
      }
      tokens.delete(token);
      entry.account.password = hashPassword(password);
      invalidateSessions(entry.account.user);
      json(200, { message: 'Kata sandi berhasil diatur ulang.' });
      return true;
    }
    if (['/auth/me/profile', '/auth/me/password'].includes(path) && method === 'PATCH') {
      if (!user) {
        error(401, 'Sesi berakhir.');
        return true;
      }
      const body = (await read()) ?? {};
      if (path.endsWith('/profile')) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const photoUrl = body.photoUrl === '' ? '' : safeEventPoster(body.photoUrl);
        if (!name || name.length > 100 || (body.photoUrl !== '' && !photoUrl.startsWith('https://'))) {
          error(422, 'Periksa nama dan URL foto HTTPS.');
          return true;
        }
        Object.assign(user, { name, photoUrl });
        json(200, user);
      } else {
        const account = accounts.get(user.email);
        if (!matchesPassword(body.currentPassword, account.password)
            || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
          error(422, 'Periksa kata sandi lama dan kata sandi baru.');
          return true;
        }
        account.password = hashPassword(body.password);
        invalidateSessions(user, authorization);
        json(200, { message: 'Kata sandi berhasil diubah.' });
      }
      return true;
    }
    return false;
  };
}
