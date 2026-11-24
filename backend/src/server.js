import { config } from './config.js';
import { createApp } from './app.js';
import { closePool } from './db.js';
import { startScheduler } from './lib/scheduler.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`EventKu API berjalan di http://localhost:${config.port}/api/v1`);
});
const stopScheduler = startScheduler(config.schedulerIntervalMs);

function shutdown() {
  stopScheduler();
  server.close(() => closePool().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
