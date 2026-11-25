import { httpServerHandler } from 'cloudflare:node';
import { Pool, neonConfig, types } from '@neondatabase/serverless';
import { createApp } from './app.js';
import { refreshConfig } from './config.js';
import { runWithPool } from './db.js';
import { runScheduledJobs } from './lib/scheduler.js';

// COUNT/SUM dari PostgreSQL berupa bigint (string); ubah ke number.
types.setTypeParser(20, (value) => Number(value));
// Query tunggal memakai HTTP fetch Neon (1 roundtrip, jauh lebih cepat & stabil daripada WebSocket per request);
// transaksi (pool.connect()) tetap memakai WebSocket interaktif penuh.
neonConfig.poolQueryViaFetch = true;

const WORKER_PORT = 3000;
const requestContexts = new Map();
let cachedHandler = null;

function createLazyNeonPool(databaseUrl) {
  let realPool = null;
  const ensure = () => {
    if (!databaseUrl) throw new Error('DATABASE_URL belum diisi di Cloudflare Workers Secrets.');
    if (!realPool) realPool = new Pool({ connectionString: databaseUrl });
    return realPool;
  };
  return {
    query(text, params) {
      return ensure().query(text, params);
    },
    connect() {
      return ensure().connect();
    },
    end() {
      if (!realPool) return Promise.resolve();
      const target = realPool;
      realPool = null;
      return target.end();
    },
  };
}

function getHandler() {
  if (cachedHandler) return cachedHandler;
  const app = createApp({
    createRequestPool(req) {
      const reqId = req.headers['x-eventku-req-id'];
      const ctxInfo = typeof reqId === 'string' ? requestContexts.get(reqId) : null;
      const databaseUrl = ctxInfo?.env?.DATABASE_URL || process.env.DATABASE_URL || '';
      const pool = createLazyNeonPool(databaseUrl);
      return {
        pool,
        onDone() {
          const closing = pool.end().catch(() => {});
          if (ctxInfo?.ctx) ctxInfo.ctx.waitUntil(closing);
        },
      };
    },
  });
  app.listen(WORKER_PORT);
  cachedHandler = httpServerHandler({ port: WORKER_PORT });
  return cachedHandler;
}

function applyWorkerEnv(env, origin) {
  const merged = {
    NODE_ENV: 'production',
    PASSWORD_HASH_ALGO: 'pbkdf2',
    ...(origin ? { CORS_ORIGINS: origin, FRONTEND_URL: origin } : {}),
    ...Object.fromEntries(
      Object.entries(env || {}).filter(([, value]) => typeof value === 'string'),
    ),
  };
  refreshConfig(merged);
}

export default {
  async fetch(request, env, ctx) {
    const origin = new URL(request.url).origin;
    applyWorkerEnv(env, origin);
    const reqId = crypto.randomUUID();
    requestContexts.set(reqId, { env, ctx });
    const headers = new Headers(request.headers);
    headers.set('x-eventku-req-id', reqId);
    const proxiedRequest = new Request(request, { headers });
    try {
      return await getHandler().fetch(proxiedRequest, env, ctx);
    } finally {
      requestContexts.delete(reqId);
    }
  },

  async scheduled(_controller, env, ctx) {
    applyWorkerEnv(env, null);
    const databaseUrl = env?.DATABASE_URL || '';
    if (!databaseUrl) return;
    const pool = new Pool({ connectionString: databaseUrl });
    const work = runWithPool(pool, () => runScheduledJobs())
      .catch((error) => console.error('Scheduler Worker gagal:', error?.message || error))
      .finally(() => pool.end().catch(() => {}));
    ctx.waitUntil(work);
  },
};
