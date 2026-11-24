import { Router } from 'express';
import { query, transaction } from '../db.js';
import { forbidden, invalid, isUuid, notFound, uuidOr404, wrap } from '../lib/errors.js';
import { EVENT_SELECT, iso, serializeEvent } from '../lib/serializers.js';
import { pageParams } from '../lib/pagination.js';
import { text } from '../lib/validators.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('mahasiswa'));

/* ---------- Notifikasi ---------- */
router.get('/notifications', wrap(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const total = (await query(`SELECT COUNT(*) AS total FROM student_notifications WHERE user_id = $1`, [req.user.id])).rows[0].total;
  const { rows } = await query(
    `SELECT * FROM student_notifications WHERE user_id = $1 ORDER BY created_at DESC, id ASC LIMIT ${limit} OFFSET ${offset}`,
    [req.user.id],
  );
  res.json({
    data: rows.map((row) => ({
      notificationId: row.id, eventId: row.event_id, title: row.title, type: row.type,
      createdAt: iso(row.created_at), isRead: row.is_read,
    })),
    total: Number(total), page,
  });
}));

router.patch('/notifications/:notificationId/read', wrap(async (req, res) => {
  const id = uuidOr404(req.params.notificationId, 'Notifikasi tidak ditemukan.');
  const result = await query(`UPDATE student_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`, [id, req.user.id]);
  if (!result.rowCount) throw notFound('Notifikasi tidak ditemukan.');
  res.json({ isRead: true });
}));

// Salinan email yang "terkirim". Belum ada SMTP, jadi pesan hanya dicatat di outbox.
router.get('/demo-mail', wrap(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const total = (await query(`SELECT COUNT(*) AS total FROM email_outbox WHERE user_id = $1`, [req.user.id])).rows[0].total;
  const { rows } = await query(
    `SELECT * FROM email_outbox WHERE user_id = $1 ORDER BY created_at DESC, id ASC LIMIT ${limit} OFFSET ${offset}`,
    [req.user.id],
  );
  res.json({
    data: rows.map((row) => ({
      notificationId: row.id, title: row.title, type: row.type, createdAt: iso(row.created_at), to: row.to_email,
    })),
    total: Number(total), page,
  });
}));

router.get('/notification-preferences', (req, res) => res.json({ emailEnabled: req.user.email_enabled === true }));

router.put('/notification-preferences', wrap(async (req, res) => {
  const { emailEnabled } = req.body ?? {};
  if (typeof emailEnabled !== 'boolean') throw invalid('Pilihan email tidak valid.', { emailEnabled: 'Harus true atau false.' });
  await query(`UPDATE users SET email_enabled = $1 WHERE id = $2`, [emailEnabled, req.user.id]);
  res.json({ emailEnabled });
}));

/* ---------- Minat kategori ---------- */
async function activeInterests(userId) {
  const { rows } = await query(
    `SELECT i.category_id FROM student_interests i JOIN categories c ON c.id = i.category_id
     WHERE i.user_id = $1 AND c.is_active = TRUE ORDER BY c.name ASC`, [userId],
  );
  return rows.map((row) => row.category_id);
}

router.get('/interests', wrap(async (req, res) => res.json({ categoryIds: await activeInterests(req.user.id) })));

router.put('/interests', wrap(async (req, res) => {
  const { categoryIds } = req.body ?? {};
  const ids = Array.isArray(categoryIds) ? [...new Set(categoryIds)] : null;
  if (!ids || ids.length > 100 || !ids.every(isUuid)) throw invalid('Pilih kategori yang aktif.', { categoryIds: 'Kategori tidak valid.' });
  if (ids.length) {
    const { rows } = await query(`SELECT id FROM categories WHERE is_active = TRUE`);
    const active = new Set(rows.map((row) => row.id));
    if (!ids.every((id) => active.has(id.toLowerCase()))) throw invalid('Pilih kategori yang aktif.', { categoryIds: 'Kategori tidak aktif.' });
  }
  await transaction(async (q) => {
    await q(`DELETE FROM student_interests WHERE user_id = $1`, [req.user.id]);
    for (const id of ids) await q(`INSERT INTO student_interests (user_id, category_id) VALUES ($1, $2)`, [req.user.id, id.toLowerCase()]);
  });
  res.json({ categoryIds: await activeInterests(req.user.id) });
}));

/* ---------- Favorit ---------- */
router.get('/favorites', wrap(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const where = `f.user_id = $1 AND e.status IN ('disetujui', 'selesai')`;
  const total = (await query(
    `SELECT COUNT(*) AS total FROM favorites f JOIN events e ON e.id = f.event_id WHERE ${where}`, [req.user.id],
  )).rows[0].total;
  const { rows } = await query(
    `${EVENT_SELECT} JOIN favorites f ON f.event_id = e.id WHERE ${where} ORDER BY e.start_at ASC, e.id ASC LIMIT ${limit} OFFSET ${offset}`,
    [req.user.id],
  );
  res.json({ data: rows.map((row) => serializeEvent(row)), total: Number(total), page });
}));

const isSaved = async (userId, eventId) => (await query(
  `SELECT 1 FROM favorites WHERE user_id = $1 AND event_id = $2`, [userId, eventId],
)).rows.length > 0;

router.get('/favorites/:eventId', wrap(async (req, res) => {
  const eventId = uuidOr404(req.params.eventId, 'Event tidak tersedia.');
  res.json({ saved: await isSaved(req.user.id, eventId) });
}));

router.put('/favorites/:eventId', wrap(async (req, res) => {
  const eventId = uuidOr404(req.params.eventId, 'Event tidak tersedia.');
  const { rows } = await query(`SELECT 1 FROM events WHERE id = $1 AND status = 'disetujui'`, [eventId]);
  if (!rows.length) throw notFound('Event tidak tersedia.');
  if (!(await isSaved(req.user.id, eventId))) {
    await query(`INSERT INTO favorites (user_id, event_id) VALUES ($1, $2)`, [req.user.id, eventId])
      .catch((error) => { if (error.code !== '23505') throw error; });
  }
  res.json({ saved: true });
}));

router.delete('/favorites/:eventId', wrap(async (req, res) => {
  const eventId = uuidOr404(req.params.eventId, 'Event tidak tersedia.');
  await query(`DELETE FROM favorites WHERE user_id = $1 AND event_id = $2`, [req.user.id, eventId]);
  res.json({ saved: false });
}));

/* ---------- Ulasan ---------- */
async function reviewableEvent(userId, eventId) {
  const { rows } = await query(
    `SELECT e.id, e.title FROM events e JOIN registrations r ON r.event_id = e.id
     WHERE e.id = $1 AND e.status = 'selesai' AND r.user_id = $2 AND r.status = 'aktif'`,
    [eventId, userId],
  );
  if (!rows.length) throw forbidden('Ulasan tersedia untuk peserta event yang sudah selesai.');
  return rows[0];
}

async function readReview(userId, event) {
  const { rows } = await query(`SELECT rating, comment FROM reviews WHERE user_id = $1 AND event_id = $2`, [userId, event.id]);
  return { title: event.title, review: rows[0] ? { rating: rows[0].rating, comment: rows[0].comment } : null };
}

router.get('/reviews/:eventId', wrap(async (req, res) => {
  const eventId = uuidOr404(req.params.eventId, 'Event tidak tersedia.');
  res.json(await readReview(req.user.id, await reviewableEvent(req.user.id, eventId)));
}));

router.put('/reviews/:eventId', wrap(async (req, res) => {
  const eventId = uuidOr404(req.params.eventId, 'Event tidak tersedia.');
  const event = await reviewableEvent(req.user.id, eventId);
  const { rating } = req.body ?? {};
  const comment = text(req.body?.comment);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment || comment.length > 1000) {
    throw invalid('Beri rating 1 sampai 5 dan isi ulasan hingga 1000 karakter.');
  }
  const updated = await query(
    `UPDATE reviews SET rating = $1, comment = $2, updated_at = $3 WHERE user_id = $4 AND event_id = $5`,
    [rating, comment, new Date(), req.user.id, eventId],
  );
  if (!updated.rowCount) {
    await query(
      `INSERT INTO reviews (user_id, event_id, rating, comment, updated_at) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, eventId, rating, comment, new Date()],
    );
  }
  res.json(await readReview(req.user.id, event));
}));

export default router;
