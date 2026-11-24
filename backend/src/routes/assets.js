import { Router } from 'express';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { query } from '../db.js';
import { invalid, notFound, uuidOr404, wrap } from '../lib/errors.js';
import { POSTER_LIMIT, POSTER_TYPES, matchesImage } from '../lib/validators.js';
import { requireAuth, requireRole, requireVerifiedOrganization } from '../middleware/auth.js';

const router = Router();
// Base64 menambah ~33%, jadi body maksimal sedikit di atas 2 MB * 4/3.
const bodyLimit = Math.ceil(POSTER_LIMIT / 3) * 4 + 1024;

// requireAuth sebelum parser: pengunjung anonim tidak bisa membuat server membaca body besar.
router.post('/posters', requireAuth, requireRole('penyelenggara'), express.json({ limit: bodyLimit }), wrap(async (req, res) => {
  requireVerifiedOrganization(req);
  const { type, data } = req.body ?? {};
  if (!POSTER_TYPES.includes(type) || typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw invalid('Poster harus berupa JPG, PNG, atau WebP.', { posterUrl: 'Format poster tidak didukung.' });
  }
  const bytes = Buffer.from(data, 'base64');
  if (!bytes.length || bytes.length > POSTER_LIMIT || !matchesImage(bytes, type)) {
    throw invalid('Format poster tidak valid atau melebihi 2 MB.', { posterUrl: 'Poster tidak valid.' });
  }
  const id = randomUUID();
  await query(
    `INSERT INTO posters (id, organization_id, content_type, data) VALUES ($1, $2, $3, $4)`,
    [id, req.user.organization_id, type, bytes.toString('base64')],
  );
  res.status(201).json({ posterUrl: `/api/v1/assets/posters/${id}` });
}));

// Poster tampil di halaman publik, jadi tidak memerlukan login.
router.get('/posters/:posterId', wrap(async (req, res) => {
  const id = uuidOr404(req.params.posterId, 'Poster tidak ditemukan.');
  const { rows } = await query(`SELECT content_type, data FROM posters WHERE id = $1`, [id]);
  if (!rows.length) throw notFound('Poster tidak ditemukan.');
  res.set({
    'Content-Type': rows[0].content_type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=86400, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(Buffer.from(rows[0].data, 'base64'));
}));

export default router;
