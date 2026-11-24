import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { query, transaction } from '../db.js';
import { conflict, notFound, uuidOr404, wrap } from '../lib/errors.js';
import { iso } from '../lib/serializers.js';
import { pageParams } from '../lib/pagination.js';
import { notifyStudent } from '../lib/notify.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * RSVP atomik. Kursi diambil dengan satu UPDATE bersyarat (reserved_seats < quota), sehingga
 * pendaftar yang berebut kursi terakhir tidak bisa melewati kuota; sisanya mendapat 409.
 */
export async function registerForEvent(eventId, user) {
  return transaction(async (q) => {
    const now = new Date();
    const { rows } = await q(
      `SELECT id, title, status, registration_mode, end_at FROM events WHERE id = $1`, [eventId],
    );
    const event = rows[0];
    if (!event || event.status !== 'disetujui') throw notFound('Event tidak tersedia.');
    if (event.registration_mode === 'external' || event.end_at.getTime() <= now.getTime()) {
      throw conflict('Pendaftaran tidak tersedia untuk event ini.');
    }

    const existing = (await q(
      `SELECT id, status FROM registrations WHERE event_id = $1 AND user_id = $2`, [eventId, user.id],
    )).rows[0];
    if (existing?.status === 'aktif') throw conflict('Anda sudah terdaftar pada event ini.');

    // Ambil kursi lebih dulu: bila kuota penuh, belum ada yang ditulis. Bila langkah setelahnya
    // gagal (mis. dua klik bersamaan), transaksi di-rollback dan kursi kembali.
    const seat = await q(
      `UPDATE events SET reserved_seats = reserved_seats + 1
       WHERE id = $1 AND status = 'disetujui' AND reserved_seats < quota AND end_at > $2`,
      [eventId, now],
    );
    if (!seat.rowCount) throw conflict('Kuota event sudah penuh.');

    let registrationId = existing?.id;
    if (existing) {
      const revived = await q(
        `UPDATE registrations SET status = 'aktif', registered_at = $1 WHERE id = $2 AND status = 'dibatalkan'`,
        [now, existing.id],
      );
      if (!revived.rowCount) throw conflict('Anda sudah terdaftar pada event ini.');
    } else {
      registrationId = randomUUID();
      await q(
        `INSERT INTO registrations (id, event_id, user_id, status, registered_at) VALUES ($1, $2, $3, 'aktif', $4)`,
        [registrationId, eventId, user.id, now],
      );
    }
    await notifyStudent(q, user.id, event, 'rsvp');
    return { registrationId, status: 'aktif' };
  });
}

router.get('/me', requireAuth, requireRole('mahasiswa'), wrap(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const upcoming = req.query.scope !== 'history';
  const active = `(r.status = 'aktif' AND e.status NOT IN ('selesai', 'dibatalkan') AND e.end_at > $2)`;
  const filter = upcoming ? active : `NOT ${active}`;
  const params = [req.user.id, new Date()];
  const total = (await query(
    `SELECT COUNT(*) AS total FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE r.user_id = $1 AND ${filter}`, params,
  )).rows[0].total;
  const { rows } = await query(
    `SELECT r.id AS registration_id, r.status AS registration_status,
            e.id AS event_id, e.title, e.start_at, e.end_at, e.location_or_link, e.status AS event_status
     FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE r.user_id = $1 AND ${filter}
     ORDER BY e.start_at ${upcoming ? 'ASC' : 'DESC'}, r.id ASC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  res.json({
    data: rows.map((row) => ({
      registrationId: row.registration_id,
      status: row.registration_status,
      event: {
        eventId: row.event_id, title: row.title, startAt: iso(row.start_at), endAt: iso(row.end_at),
        locationOrLink: row.location_or_link, status: row.event_status,
      },
    })),
    total: Number(total),
    page,
  });
}));

router.delete('/:registrationId', requireAuth, requireRole('mahasiswa'), wrap(async (req, res) => {
  const id = uuidOr404(req.params.registrationId, 'Pendaftaran tidak tersedia.');
  await transaction(async (q) => {
    const { rows } = await q(
      `SELECT r.id, r.status, r.event_id, e.status AS event_status, e.start_at
       FROM registrations r JOIN events e ON e.id = r.event_id
       WHERE r.id = $1 AND r.user_id = $2`,
      [id, req.user.id],
    );
    const row = rows[0];
    if (!row) throw notFound('Pendaftaran tidak tersedia.');
    if (row.status !== 'aktif' || row.event_status === 'dibatalkan' || row.start_at.getTime() <= Date.now()) {
      throw conflict('Pendaftaran tidak dapat dibatalkan.');
    }
    const cancelled = await q(
      `UPDATE registrations SET status = 'dibatalkan' WHERE id = $1 AND status = 'aktif'`, [id],
    );
    if (!cancelled.rowCount) throw conflict('Pendaftaran tidak dapat dibatalkan.');
    await q(`UPDATE events SET reserved_seats = reserved_seats - 1 WHERE id = $1 AND reserved_seats > 0`, [row.event_id]);
  });
  res.json({ message: 'Pendaftaran dibatalkan.' });
}));

export default router;
