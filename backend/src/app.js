import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { readFileSync } from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';
import { config } from './config.js';
import { runWithPool } from './db.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import eventRoutes from './routes/events.js';
import registrationRoutes from './routes/registrations.js';
import organizerRoutes from './routes/organizer.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';
import studentRoutes from './routes/student.js';
import assetRoutes from './routes/assets.js';

const swaggerDocument = config.isWorker
  ? null
  : parse(readFileSync(new URL('../../docs/openapi.yaml', import.meta.url), 'utf8'));

export function createApp({ createRequestPool } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Di balik proxy (Cloudflare / reverse proxy) IP klien ada di X-Forwarded-For; dibutuhkan rate limiter.
  if (config.isProduction || config.isWorker) app.set('trust proxy', 1);
  if (createRequestPool) {
    app.use((req, res, next) => {
      const handle = createRequestPool(req);
      if (!handle) return next();
      let closed = false;
      const done = () => {
        if (closed) return;
        closed = true;
        handle.onDone();
      };
      res.once('finish', done);
      res.once('close', done);
      return runWithPool(handle.pool, () => next());
    });
  }
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, config.corsOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    maxAge: 600,
  }));

  if (!config.isWorker) {
    app.use('/api-docs', (_req, res, next) => {
      res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http: https:");
      next();
    }, swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      explorer: true,
      swaggerOptions: { validatorUrl: null },
    }));
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const api = express.Router();
  // Poster punya parser JSON sendiri (batas lebih besar), jadi dipasang sebelum parser global.
  api.use('/assets', assetRoutes);
  api.use(express.json({ limit: '64kb' }));
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  api.use('/auth', authRoutes);
  api.use('/categories', categoryRoutes);
  api.use('/events', eventRoutes);
  api.use('/registrations', registrationRoutes);
  api.use('/organizer', organizerRoutes);
  api.use('/admin', adminRoutes);
  api.use('/notifications', notificationRoutes);
  api.use('/student', studentRoutes);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
