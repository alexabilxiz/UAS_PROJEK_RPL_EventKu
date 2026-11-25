import 'dotenv/config';

const isWorkerRuntime = typeof globalThis.WebSocketPair !== 'undefined';

function buildConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  if (isProduction && !isWorkerRuntime && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET wajib diisi (minimal 32 karakter) pada production.');
  }
  const defaultHashAlgo = isWorkerRuntime ? 'pbkdf2' : 'bcrypt';
  return {
    isWorker: isWorkerRuntime,
    isProduction,
    isTest: env.NODE_ENV === 'test',
    port: Number(env.PORT) || 3000,
    databaseUrl: env.DATABASE_URL || '',
    // Neon dan sebagian host mewajibkan SSL.
    databaseSsl: env.DATABASE_SSL ? env.DATABASE_SSL !== 'false' : isProduction,
    jwtSecret: env.JWT_SECRET || (isProduction ? '' : 'dev-only-secret-change-me-dev-only-secret'),
    jwtExpiresInSeconds: Number(env.JWT_EXPIRES_IN_SECONDS) || 8 * 60 * 60,
    bcryptRounds: Number(env.BCRYPT_ROUNDS) || 10,
    passwordHashAlgo: (env.PASSWORD_HASH_ALGO || defaultHashAlgo).trim().toLowerCase(),
    corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',').map((item) => item.trim()).filter(Boolean),
    // Akun mahasiswa dianggap terverifikasi UKWMS bila domain emailnya ada di daftar ini.
    ukwmsEmailDomains: (env.UKWMS_EMAIL_DOMAINS || 'student.ukwms.ac.id')
      .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
    frontendUrl: env.FRONTEND_URL || 'http://localhost:5173',
    rateLimitEnabled: env.RATE_LIMIT_ENABLED ? env.RATE_LIMIT_ENABLED !== 'false' : env.NODE_ENV !== 'test',
    schedulerIntervalMs: Number(env.SCHEDULER_INTERVAL_MS) || 60_000,
  };
}

export const config = buildConfig(process.env);

/** Perbarui konfigurasi secara dinamis dari Cloudflare Workers env binding. */
export function refreshConfig(env = process.env) {
  Object.assign(config, buildConfig(env));
  return config;
}
