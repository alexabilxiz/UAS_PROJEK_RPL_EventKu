import bcrypt from 'bcryptjs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const PBKDF2_PREFIX = 'pbkdf2$sha256$';
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LEN = 32;
const textEncoder = new TextEncoder();

// Hash statis untuk menghindari komputasi mahal saat startup modul (penting di Cloudflare Workers).
const STATIC_BCRYPT_DUMMY = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
const STATIC_PBKDF2_DUMMY = 'pbkdf2$sha256$100000$00112233445566778899aabbccddeeff$00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

function toHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

function fromHex(hex) {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

async function derivePbkdf2(password, saltBytes, iterations) {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    PBKDF2_KEY_LEN * 8,
  );
  return new Uint8Array(derived);
}

/**
 * Hash kata sandi.
 * Di Cloudflare Workers (atau bila PASSWORD_HASH_ALGO=pbkdf2), memakai PBKDF2-SHA256 Web Crypto
 * native (< 2 ms CPU) agar aman terhadap batas CPU Workers Free Plan; di Node.js tetap memakai bcrypt.
 */
export async function hashPassword(password) {
  if (config.passwordHashAlgo === 'pbkdf2') {
    const salt = new Uint8Array(randomBytes(16));
    const derived = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
    return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(derived)}`;
  }
  return bcrypt.hash(password, config.bcryptRounds);
}

/** Verifikasi kata sandi untuk format PBKDF2 maupun bcrypt lama. */
export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string' || !storedHash) return false;
  if (storedHash.startsWith(PBKDF2_PREFIX)) {
    const parts = storedHash.split('$');
    if (parts.length !== 5) return false;
    const iterations = Number(parts[2]);
    if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 1_000_000) return false;
    const salt = fromHex(parts[3]);
    const expected = fromHex(parts[4]);
    if (!salt.length || expected.length !== PBKDF2_KEY_LEN) return false;
    const actual = await derivePbkdf2(password, salt, iterations);
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  }
  return bcrypt.compare(password, storedHash);
}

export function dummyPasswordHash() {
  return config.passwordHashAlgo === 'pbkdf2' ? STATIC_PBKDF2_DUMMY : STATIC_BCRYPT_DUMMY;
}
