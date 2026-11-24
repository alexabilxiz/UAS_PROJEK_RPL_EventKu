import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
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

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Di balik proxy (Render) IP klien ada di X-Forwarded-For; dibutuhkan rate limiter.
  if (config.isProduction) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    maxAge: 600,
  }));

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
