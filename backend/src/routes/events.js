import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { query } from '../db.js';
import { conflict, forbidden, invalid, isUuid, notFound, uuidOr404, wrap } from '../lib/errors.js';
import { EVENT_SELECT, serializeEvent } from '../lib/serializers.js';
import { pageParams } from '../lib/pagination.js';
import { isEventDate, isEventTimestamp, text } from '../lib/validators.js';
import { parseEventInput } from '../lib/eventInput.js';
import { optionalAuth, requireAuth, requireRole, requireVerifiedOrganization } from '../middleware/auth.js';
import { registerForEvent } from './registrations.js';

const router = Router();
const WIB_OFFSET = '+07:00';

router.get('/', wrap(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const q = text(req.query.q);
  const { category, organizer, date, from, to } = req.query;
  const hasRange = Boolean(from || to);
  if ((date && !isEventDate(date)) || (date && hasRange)
      || (hasRange && (!isEventTimestamp(from) || !isEventTimestamp(to) || Date.parse(from) >= Date.parse(to)))) {
    throw invalid('Periksa kembali tanggal dan halaman pencarian.');
  }

  const where = [`e.status = 'disetujui'`];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
  if (q) {
    const pattern = `%${q.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    params.push(pattern);
    where.push(`(LOWER(e.title) LIKE $${params.length} OR LOWER(e.description) LIKE $${params.length})`);
  }
  // Filter dengan ID yang bukan UUID pasti tidak cocok; hasilnya kosong, bukan error.
  if (category) add('e.category_id = ?', isUuid(category) ? category : randomUUID());
  if (organizer) add('e.organization_id = ?', isUuid(organizer) ? organizer : randomUUID());
  if (date) {
    const start = new Date(`${date}T00:00:00${WIB_OFFSET}`);
    add('e.start_at >= ?', start);
    add('e.start_at < ?', new Date(start.getTime() + 86_400_000));
  }
  if (from) add('e.start_at >= ?', new Date(from));
  if (to) add('e.start_at < ?', new Date(to));

  const clause = where.join(' AND ');
  const total = (await query(`SELECT COUNT(*) AS total FROM events e WHERE ${clause}`, params)).rows[0].total;
  const { rows } = await query(
    `${EVENT_SELECT} WHERE ${clause} ORDER BY e.start_at ASC, e.id ASC LIMIT ${limit} OFFSET ${offset}`, params,
  );
  res.json({ data: rows.map((row) => serializeEvent(row)), total: Number(total), page });
}));

router.get('/:eventId', optionalAuth, wrap(async (req, res) => {
  const id = uuidOr404(req.params.eventId, 'Event tidak tersedia.');
  const { rows } = await query(`${EVENT_SELECT} WHERE e.id = $1`, [id]);
  const row = rows[0];
  const owner = req.user?.role === 'penyelenggara' && req.user.organization_id === row?.organization_id;
  if (!row || (row.status !== 'disetujui' && !owner)) throw notFound('Event tidak tersedia.');
  res.json({ event: serializeEvent(row, { internal: owner }) });
}));

router.post('/', requireAuth, requireRole('penyelenggara'), wrap(async (req, res) => {
  requireVerifiedOrganization(req);
  const fields = await parseEventInput(req.body, { organizationId: req.user.organization_id });
  const eventId = randomUUID();
  await query(
    `INSERT INTO events (id, organization_id, category_id, title, description, start_at, end_at, location_or_link,
       poster_url, registration_mode, audience, registration_url, quota, reserved_seats, status, version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,'draft',0)`,
    [eventId, req.user.organization_id, fields.categoryId, fields.title, fields.description, fields.startAt,
      fields.endAt, fields.locationOrLink, fields.posterUrl, fields.registrationMode, fields.audience,
      fields.registrationUrl, fields.quota],
  );
  res.status(201).json({ eventId, status: 'draft' });
}));

router.patch('/:eventId/submit', requireAuth, requireRole('penyelenggara'), wrap(async (req, res) => {
  const id = uuidOr404(req.params.eventId, 'Event tidak tersedia.');
  const { rows } = await query(`SELECT * FROM events WHERE id = $1`, [id]);
  const event = rows[0];
  if (!event || event.organization_id !== req.user.organization_id) throw notFound('Event tidak tersedia.');
  requireVerifiedOrganization(req);
  if (event.status !== 'draft') throw conflict('Status draft sudah berubah.');
  if (event.start_at.getTime() <= Date.now()) throw invalid('Jadwal draft harus diperbarui.', { startAt: 'Jadwal sudah lewat.' });
  const now = new Date();
  // Syarat status ikut di WHERE supaya dua klik bersamaan tidak mengajukan dua kali.
  const result = await query(
    `UPDATE events SET status = 'menunggu_moderasi', submitted_at = $1, version = version + 1
     WHERE id = $2 AND status = 'draft'`,
    [now, id],
  );
  if (!result.rowCount) throw conflict('Status draft sudah berubah.');
  res.json({ status: 'menunggu_moderasi' });
}));

router.post('/:eventId/registrations', requireAuth, requireRole('mahasiswa'), wrap(async (req, res) => {
  const id = uuidOr404(req.params.eventId, 'Event tidak tersedia.');
  if (req.user.ukwms_verified !== true) throw forbidden('RSVP khusus mahasiswa UKWMS terverifikasi.');
  const registration = await registerForEvent(id, req.user);
  res.status(201).json(registration);
}));

export default router;
