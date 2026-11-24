import 'dotenv/config';

const env = process.env;
const isProduction = env.NODE_ENV === 'production';

if (isProduction && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET wajib diisi (minimal 32 karakter) pada production.');
}

export const config = {
  isProduction,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT) || 3000,
  databaseUrl: env.DATABASE_URL || '',
  // Neon dan sebagian host mewajibkan SSL.
  databaseSsl: env.DATABASE_SSL ? env.DATABASE_SSL !== 'false' : isProduction,
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me-dev-only-secret',
  jwtExpiresInSeconds: Number(env.JWT_EXPIRES_IN_SECONDS) || 8 * 60 * 60,
  bcryptRounds: Number(env.BCRYPT_ROUNDS) || 10,
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((item) => item.trim()).filter(Boolean),
  // Akun mahasiswa dianggap terverifikasi UKWMS bila domain emailnya ada di daftar ini.
  ukwmsEmailDomains: (env.UKWMS_EMAIL_DOMAINS || 'student.ukwms.ac.id')
    .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
  frontendUrl: env.FRONTEND_URL || 'http://localhost:5173',
  rateLimitEnabled: env.RATE_LIMIT_ENABLED ? env.RATE_LIMIT_ENABLED !== 'false' : env.NODE_ENV !== 'test',
  schedulerIntervalMs: Number(env.SCHEDULER_INTERVAL_MS) || 60_000,
};
