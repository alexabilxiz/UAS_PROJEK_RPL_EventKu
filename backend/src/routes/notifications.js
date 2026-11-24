import { Router } from 'express';
import { query } from '../db.js';
import { notFound, uuidOr404, wrap } from '../lib/errors.js';
import { iso } from '../lib/serializers.js';
import { pageParams } from '../lib/pagination.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Notifikasi hasil moderasi untuk penyelenggara.
const router = Router();
router.use(requireAuth, requireRole('penyelenggara'));

router.get('/me', wrap(async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const total = (await query(
    `SELECT COUNT(*) AS total FROM organizer_notifications WHERE organization_id = $1`, [req.user.organization_id],
  )).rows[0].total;
  const { rows } = await query(
    `SELECT n.*, (r.user_id IS NOT NULL) AS is_read
     FROM organizer_notifications n
     LEFT JOIN organizer_notification_reads r ON r.notification_id = n.id AND r.user_id = $2
     WHERE n.organization_id = $1 ORDER BY n.created_at DESC, n.id ASC LIMIT ${limit} OFFSET ${offset}`,
    [req.user.organization_id, req.user.id],
  );
  res.json({
    data: rows.map((row) => ({
      notificationId: row.id, eventId: row.event_id, title: row.title, status: row.status,
      reason: row.reason, createdAt: iso(row.created_at), isRead: Boolean(row.is_read),
    })),
    total: Number(total), page,
  });
}));

router.patch('/me/:notificationId/read', wrap(async (req, res) => {
  const id = uuidOr404(req.params.notificationId, 'Notifikasi tidak ditemukan.');
  const { rows } = await query(
    `SELECT id FROM organizer_notifications WHERE id = $1 AND organization_id = $2`, [id, req.user.organization_id],
  );
  if (!rows.length) throw notFound('Notifikasi tidak ditemukan.');
  const read = await query(
    `SELECT 1 FROM organizer_notification_reads WHERE notification_id = $1 AND user_id = $2`, [id, req.user.id],
  );
  if (!read.rows.length) {
    await query(`INSERT INTO organizer_notification_reads (notification_id, user_id) VALUES ($1, $2)`, [id, req.user.id])
      .catch((error) => { if (error.code !== '23505') throw error; });
  }
  res.json({ notificationId: id, isRead: true });
}));

export default router;
