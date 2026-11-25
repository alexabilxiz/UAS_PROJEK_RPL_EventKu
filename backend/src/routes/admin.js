import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { query, transaction } from '../db.js';
import { conflict, forbidden, invalid, notFound, uuidOr404, wrap } from '../lib/errors.js';
import { EVENT_SELECT, iso, serializeEvent } from '../lib/serializers.js';
import { pageParams } from '../lib/pagination.js';
import { notifyInterested, notifyRegistrants } from '../lib/notify.js';
import { text } from '../lib/validators.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const WIB_MS = 7 * 60 * 60 * 1000;
const organization = (row) => ({ organizationId: row.id, name: row.name, status: row.status });
const category = (row) => ({ categoryId: row.id, name: row.name, isActive: row.is_active });

async function paged(req, res, { count, select, params = [], map }) {
  const { page, limit, offset } = pageParams(req.query);
  const total = (await query(count, params)).rows[0].total;
  const { rows } = await query(`${select} LIMIT ${limit} OFFSET ${offset}`, params);
  res.json({ data: rows.map(map), total: Number(total), page });
}

/* ---------- Pengguna ---------- */
router.get('/users', wrap((req, res) => paged(req, res, {
  count: `SELECT COUNT(*) AS total FROM users`,
  select: `SELECT id, name, email, role, status FROM users ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at ASC, id ASC`,
  map: (row) => ({ userId: row.id, name: row.name, email: row.email, role: row.role, status: row.status }),
})));

router.patch('/users/:userId', wrap(async (req, res) => {
  const id = uuidOr404(req.params.userId, 'Akun tidak ditemukan.');
  const { rows } = await query(`SELECT id, role FROM users WHERE id = $1`, [id]);
  if (!rows.length) throw notFound('Akun tidak ditemukan.');
  if (rows[0].role === 'admin') throw forbidden('Akun admin dilindungi.');
  const { status } = req.body ?? {};
  if (!['active', 'disabled'].includes(status)) throw invalid('Status akun tidak valid.', { status: 'Status tidak valid.' });
  await transaction(async (q) => {
    await q(`UPDATE users SET status = $1 WHERE id = $2`, [status, id]);
    if (status === 'disabled') await q(`DELETE FROM sessions WHERE user_id = $1`, [id]);
  });
  res.json({ userId: id, status });
}));

router.get('/statistics', wrap(async (_req, res) => {
  const count = async (sql) => Number((await query(sql)).rows[0].total);
  const [users, events, registrations] = await Promise.all([
    count(`SELECT COUNT(*) AS total FROM users`),
    count(`SELECT COUNT(*) AS total FROM events`),
    count(`SELECT COUNT(*) AS total FROM registrations r JOIN events e ON e.id = r.event_id
           WHERE r.status = 'aktif' AND e.status <> 'dibatalkan'`),
  ]);
  const categories = (await query(
    `SELECT c.name AS label, COUNT(e.id) AS total FROM categories c
     LEFT JOIN events e ON e.category_id = c.id GROUP BY c.id, c.name ORDER BY c.name ASC`,
  )).rows.map((row) => ({ label: row.label, total: Number(row.total) }));
  const months = new Map();
  for (const { start_at: start } of (await query(`SELECT start_at FROM events`)).rows) {
    const month = new Date(start.getTime() + WIB_MS).toISOString().slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
  }
  res.json({
    users, events, registrations, categories,
    months: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([label, total]) => ({ label, total })),
  });
}));

/* ---------- Organisasi ---------- */
router.get('/organizations', wrap((req, res) => paged(req, res, {
  count: `SELECT COUNT(*) AS total FROM organizations`,
  select: `SELECT id, name, status FROM organizations ORDER BY created_at ASC, id ASC`,
  map: organization,
})));

// Frontend belum punya layar ini, tetapi organisasi harus bisa dibuat agar penyelenggara dapat mendaftar.
router.post('/organizations', wrap(async (req, res) => {
  const name = text(req.body?.name);
  if (!name || name.length > 150) throw invalid('Nama organisasi tidak valid.', { name: 'Nama wajib diisi (maksimal 150 karakter).' });
  const row = { id: randomUUID(), name, status: 'pending' };
  await query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'pending')`, [row.id, name]);
  res.status(201).json(organization(row));
}));

router.patch('/organizations/:organizationId', wrap(async (req, res) => {
  const id = uuidOr404(req.params.organizationId, 'Organisasi tidak ditemukan.');
  const { status } = req.body ?? {};
  const existing = await query(`SELECT id FROM organizations WHERE id = $1`, [id]);
  if (!existing.rows.length) throw notFound('Organisasi tidak ditemukan.');
  if (!['verified', 'suspended'].includes(status)) throw invalid('Status organisasi tidak valid.', { status: 'Status tidak valid.' });
  await query(`UPDATE organizations SET status = $1 WHERE id = $2`, [status, id]);
  const { rows } = await query(`SELECT id, name, status FROM organizations WHERE id = $1`, [id]);
  res.json(organization(rows[0]));
}));

/* ---------- Kategori ---------- */
router.get('/categories', wrap((req, res) => paged(req, res, {
  count: `SELECT COUNT(*) AS total FROM categories`,
  select: `SELECT id, name, is_active FROM categories ORDER BY created_at ASC, id ASC`,
  map: category,
})));

async function ensureUniqueName(name, exceptId) {
  const { rows } = await query(`SELECT id FROM categories WHERE LOWER(name) = $1`, [name.toLowerCase()]);
  if (rows.some((row) => row.id !== exceptId)) throw conflict('Nama kategori sudah digunakan.');
}

router.post('/categories', wrap(async (req, res) => {
  const name = text(req.body?.name);
  if (!name || name.length > 80) throw invalid('Nama kategori tidak valid.', { name: 'Nama wajib diisi (maksimal 80 karakter).' });
  await ensureUniqueName(name);
  const row = { id: randomUUID(), name, is_active: true };
  await query(`INSERT INTO categories (id, name, is_active) VALUES ($1, $2, TRUE)`, [row.id, name]);
  res.status(201).json(category(row));
}));

router.patch('/categories/:categoryId', wrap(async (req, res) => {
  const id = uuidOr404(req.params.categoryId, 'Kategori tidak ditemukan.');
  const name = text(req.body?.name);
  const isActive = req.body?.isActive;
  if (!name || name.length > 80 || typeof isActive !== 'boolean') {
    throw invalid('Nama atau status kategori tidak valid.', { name: 'Nama atau status tidak valid.' });
  }
  const existing = await query(`SELECT id FROM categories WHERE id = $1`, [id]);
  if (!existing.rows.length) throw notFound('Kategori tidak ditemukan.');
  await ensureUniqueName(name, id);
  await query(`UPDATE categories SET name = $1, is_active = $2 WHERE id = $3`, [name, isActive, id]);
  res.json(category({ id, name, is_active: isActive }));
}));

/* ---------- Moderasi event ---------- */
router.get('/events/moderation', wrap(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const { scope } = req.query;
  if (scope === 'history') {
    const total = (await query(`SELECT COUNT(*) AS total FROM moderation_history`)).rows[0].total;
    const { rows } = await query(
      `SELECT * FROM moderation_history ORDER BY moderated_at DESC, id ASC LIMIT ${limit} OFFSET ${offset}`,
    );
    return res.json({
      data: rows.map((row) => ({
        historyId: row.id, eventId: row.event_id, title: row.title, adminName: row.admin_name,
        status: row.status, reason: row.reason, moderatedAt: iso(row.moderated_at),
      })),
      total: Number(total), page,
    });
  }
  const status = scope === 'published' ? 'disetujui' : 'menunggu_moderasi';
  const order = scope === 'published' ? 'e.start_at ASC' : 'e.submitted_at ASC';
  const total = (await query(`SELECT COUNT(*) AS total FROM events WHERE status = $1`, [status])).rows[0].total;
  const { rows } = await query(
    `${EVENT_SELECT} WHERE e.status = $1 ORDER BY ${order}, e.id ASC LIMIT ${limit} OFFSET ${offset}`, [status],
  );
  return res.json({ data: rows.map((row) => serializeEvent(row, { internal: true })), total: Number(total), page });
}));

router.patch('/events/moderation/:eventId', wrap(async (req, res) => {
  const id = uuidOr404(req.params.eventId, 'Event tidak tersedia.');
  const { status } = req.body ?? {};
  const reason = text(req.body?.reason);
  if (!['disetujui', 'ditolak', 'dibatalkan'].includes(status)
      || (status !== 'disetujui' && (!reason || reason.length > 500))) {
    throw invalid('Keputusan atau alasan penolakan tidak valid.', status === 'disetujui' ? undefined : { reason: 'Alasan wajib diisi (maksimal 500 karakter).' });
  }
  const finalReason = status === 'disetujui' ? '' : reason;
  await transaction(async (q) => {
    const { rows } = await q(`SELECT * FROM events WHERE id = $1`, [id]);
    const event = rows[0];
    if (!event) throw notFound('Event tidak tersedia.');
    const expected = status === 'dibatalkan' ? 'disetujui' : 'menunggu_moderasi';
    if (event.status !== expected) throw conflict('Status event sudah berubah.');
    if (status === 'disetujui' && event.end_at.getTime() <= Date.now()) throw conflict('Jadwal event sudah berakhir.');
    const updated = await q(
      `UPDATE events SET status = $1, rejection_reason = $2, version = version + 1 WHERE id = $3 AND status = $4`,
      [status, status === 'ditolak' ? finalReason : '', id, expected],
    );
    if (!updated.rowCount) throw conflict('Status event sudah berubah.');
    const now = new Date();
    await q(
      `INSERT INTO moderation_history (id, event_id, title, admin_name, status, reason, moderated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), id, event.title, req.user.name, status, finalReason, now],
    );
    await q(
      `INSERT INTO organizer_notifications (id, organization_id, event_id, title, status, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), event.organization_id, id, event.title, status, finalReason, now],
    );
    if (status === 'disetujui') await notifyInterested(q, event);
    if (status === 'dibatalkan') await notifyRegistrants(q, event, 'event_dibatalkan');
  });
  res.json({ eventId: id, status });
}));

export default router;
