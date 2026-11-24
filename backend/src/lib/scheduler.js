import { query, transaction } from '../db.js';
import { notifyStudent } from './notify.js';

const DAY_MS = 86_400_000;

/** Event tayang yang sudah lewat jam selesai berubah menjadi `selesai`. */
export async function completeFinishedEvents(now = new Date()) {
  const result = await query(
    `UPDATE events SET status = 'selesai' WHERE status = 'disetujui' AND end_at <= $1`, [now],
  );
  return result.rowCount;
}

/** Kirim pengingat H-1 satu kali per pendaftaran aktif untuk jadwal yang sama. */
export async function sendReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + DAY_MS);
  const { rows } = await query(
    `SELECT r.id AS registration_id, r.user_id, e.id, e.title, e.start_at
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN reminders_sent s ON s.registration_id = r.id AND s.start_at = e.start_at
     WHERE r.status = 'aktif' AND e.status = 'disetujui' AND e.start_at > $1 AND e.start_at <= $2
       AND s.registration_id IS NULL`,
    [now, horizon],
  );
  for (const row of rows) {
    await transaction(async (q) => {
      await q(`INSERT INTO reminders_sent (registration_id, start_at) VALUES ($1, $2)`, [row.registration_id, row.start_at]);
      await notifyStudent(q, row.user_id, { id: row.id, title: row.title }, 'pengingat');
    }).catch((error) => {
      // Dua instance server bisa berebut baris yang sama; pelanggar primary key aman diabaikan.
      if (error.code !== '23505') throw error;
    });
  }
  return rows.length;
}

export async function runScheduledJobs(now = new Date()) {
  await completeFinishedEvents(now);
  await sendReminders(now);
}

export function startScheduler(intervalMs) {
  const timer = setInterval(() => {
    runScheduledJobs().catch((error) => console.error('Scheduler gagal:', error.message));
  }, intervalMs);
  timer.unref();
  runScheduledJobs().catch((error) => console.error('Scheduler gagal:', error.message));
  return () => clearInterval(timer);
}
