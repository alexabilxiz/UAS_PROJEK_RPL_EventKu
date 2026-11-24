import { Router } from 'express';
import { query, transaction } from '../db.js';
import { conflict, invalid, notFound, uuidOr404, wrap } from '../lib/errors.js';
import { EVENT_SELECT, iso, serializeEvent } from '../lib/serializers.js';
import { pageParams } from '../lib/pagination.js';
import { parseEventInput } from '../lib/eventInput.js';
import { notifyRegistrants } from '../lib/notify.js';
import { participantsCsv } from '../lib/csv.js';
import { requireAuth, requireRole, requireVerifiedOrganization } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('penyelenggara'));

const EDITABLE = ['draft', 'menunggu_moderasi', 'disetujui', 'ditolak'];
const WIB_MS = 7 * 60 * 60 * 1000;

async function ownedEvent(req, eventId) {
  const id = uuidOr404(eventId, 'Event organisasi tidak ditemukan.');
  const { rows } = await query(`${EVENT_SELECT} WHERE e.id = $1 AND e.organization_id = $2`, [id, req.user.organization_id]);
  if (!rows.length) throw notFound('Event organisasi tidak ditemukan.');
  return rows[0];
}

router.get('/events', wrap(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const total = (await query(`SELECT COUNT(*) AS total FROM events WHERE organization_id = $1`, [req.user.organization_id])).rows[0].total;
  const { rows } = await query(
    `${EVENT_SELECT} WHERE e.organization_id = $1 ORDER BY e.created_at DESC, e.id ASC LIMIT ${limit} OFFSET ${offset}`,
    [req.user.organization_id],
  );
  res.json({ data: rows.map((row) => serializeEvent(row, { internal: true })), total: Number(total), page });
}));

router.get('/statistics', wrap(async (req, res) => {
  const orgId = req.user.organization_id;
  const quotaRow = (await query(
    `SELECT COALESCE(SUM(quota), 0) AS quota, COALESCE(SUM(reserved_seats), 0) AS filled
     FROM events WHERE organization_id = $1 AND registration_mode = 'internal' AND status IN ('disetujui', 'selesai')`,
    [orgId],
  )).rows[0];
  const { rows } = await query(
    `SELECT r.registered_at FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE e.organization_id = $1 AND e.registration_mode = 'internal' AND e.status <> 'dibatalkan' AND r.status = 'aktif'`,
    [orgId],
  );
  const days = new Map();
  for (const { registered_at: at } of rows) {
    const day = new Date(at.getTime() + WIB_MS).toISOString().slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  const quota = Number(quotaRow.quota);
  res.json({
    active: rows.length,
    occupancy: quota ? Math.round((100 * Number(quotaRow.filled)) / quota) : 0,
    trend: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([label, total]) => ({ label, total })),
  });
}));

router.get('/events/:eventId', wrap(async (req, res) => {
  res.json({ event: serializeEvent(await ownedEvent(req, req.params.eventId), { internal: true }) });
}));

router.patch('/events/:eventId', wrap(async (req, res) => {
  const current = await ownedEvent(req, req.params.eventId);
  requireVerifiedOrganization(req);
  const { action, expectedStatus, expectedVersion } = req.body ?? {};
  if (!['update', 'cancel'].includes(action)) throw invalid('Aksi event tidak valid.');
  if (!EDITABLE.includes(current.status) || expectedStatus !== current.status || expectedVersion !== current.version) {
    throw conflict('Event sudah berubah. Muat ulang halaman lalu coba lagi.');
  }

  if (action === 'cancel') {
    await transaction(async (q) => {
      const done = await q(
        `UPDATE events SET status = 'dibatalkan', version = version + 1 WHERE id = $1 AND status = $2 AND version = $3`,
        [current.id, current.status, current.version],
      );
      if (!done.rowCount) throw conflict('Event sudah berubah. Muat ulang halaman lalu coba lagi.');
      await notifyRegistrants(q, current, 'event_dibatalkan');
    });
  } else {
    const fields = await parseEventInput(req.body.event, { organizationId: req.user.organization_id, current });
    if (current.reserved_seats > 0 && (fields.registrationMode === 'external' || fields.quota < current.reserved_seats)) {
      throw conflict('Kuota atau mode pendaftaran bertentangan dengan peserta aktif.');
    }
    const scheduleChanged = fields.startAt.getTime() !== current.start_at.getTime()
      || fields.endAt.getTime() !== current.end_at.getTime()
      || fields.locationOrLink !== current.location_or_link;
    const republish = current.status === 'disetujui' && scheduleChanged; // perubahan jadwal event tayang → moderasi ulang
    const nextStatus = republish ? 'menunggu_moderasi' : current.status === 'ditolak' ? 'draft' : current.status;
    await transaction(async (q) => {
      const done = await q(
        `UPDATE events SET category_id = $1, title = $2, description = $3, start_at = $4, end_at = $5,
           location_or_link = $6, poster_url = $7, registration_mode = $8, audience = $9, registration_url = $10,
           quota = $11, status = $12, submitted_at = $13, rejection_reason = $14, version = version + 1
         WHERE id = $15 AND status = $16 AND version = $17`,
        [fields.categoryId, fields.title, fields.description, fields.startAt, fields.endAt, fields.locationOrLink,
          fields.posterUrl, fields.registrationMode, fields.audience, fields.registrationUrl, fields.quota,
          nextStatus, republish ? new Date() : current.submitted_at,
          nextStatus === 'draft' ? '' : current.rejection_reason, current.id, current.status, current.version],
      );
      if (!done.rowCount) throw conflict('Event sudah berubah. Muat ulang halaman lalu coba lagi.');
      if (republish) await notifyRegistrants(q, current, 'jadwal_berubah');
    });
  }
  const { rows } = await query(`${EVENT_SELECT} WHERE e.id = $1`, [current.id]);
  res.json({ event: serializeEvent(rows[0], { internal: true }) });
}));

router.get('/events/:eventId/participants', wrap(async (req, res) => {
  requireVerifiedOrganization(req);
  const event = await ownedEvent(req, req.params.eventId);
  const base = `FROM registrations r JOIN users u ON u.id = r.user_id WHERE r.event_id = $1 AND r.status = 'aktif'`;
  const select = `SELECT r.id AS registration_id, r.registered_at, u.name, u.email ${base} ORDER BY r.registered_at ASC, r.id ASC`;
  const toRow = (row) => ({
    registrationId: row.registration_id, name: row.name, email: row.email, registeredAt: iso(row.registered_at),
  });
  if (req.query.format === 'csv') {
    const { rows } = await query(select, [event.id]);
    return res.json({ csv: participantsCsv(rows.map(toRow)) });
  }
  const { page, limit, offset } = pageParams(req.query);
  const total = (await query(`SELECT COUNT(*) AS total ${base}`, [event.id])).rows[0].total;
  const { rows } = await query(`${select} LIMIT ${limit} OFFSET ${offset}`, [event.id]);
  return res.json({ data: rows.map(toRow), total: Number(total), page, eventTitle: event.title });
}));

export default router;
