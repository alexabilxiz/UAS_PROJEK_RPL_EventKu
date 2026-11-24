import { randomUUID } from 'node:crypto';

/** Tambah notifikasi mahasiswa; salinan email masuk outbox bila pengguna mengaktifkannya. */
export async function notifyStudent(q, userId, event, type) {
  const { rows } = await q(
    `SELECT email, email_enabled FROM users WHERE id = $1 AND status = 'active' AND role = 'mahasiswa'`,
    [userId],
  );
  if (!rows.length) return;
  const now = new Date();
  const id = randomUUID();
  await q(
    `INSERT INTO student_notifications (id, user_id, event_id, title, type, is_read, created_at)
     VALUES ($1, $2, $3, $4, $5, FALSE, $6)`,
    [id, userId, event.id, event.title, type, now],
  );
  if (rows[0].email_enabled) {
    await q(
      `INSERT INTO email_outbox (id, user_id, to_email, title, type, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), userId, rows[0].email, event.title, type, now],
    );
  }
}

/** Kabari semua peserta aktif (jadwal berubah / event dibatalkan). */
export async function notifyRegistrants(q, event, type) {
  const { rows } = await q(
    `SELECT user_id FROM registrations WHERE event_id = $1 AND status = 'aktif'`, [event.id],
  );
  for (const row of rows) await notifyStudent(q, row.user_id, event, type);
}

/** Kabari mahasiswa yang berminat pada kategori event yang baru tayang. */
export async function notifyInterested(q, event) {
  const { rows } = await q(
    `SELECT user_id FROM student_interests WHERE category_id = $1`, [event.category_id],
  );
  for (const row of rows) await notifyStudent(q, row.user_id, event, 'event_baru');
}
