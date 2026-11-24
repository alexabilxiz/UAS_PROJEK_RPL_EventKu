import { Router } from 'express';
import { query } from '../db.js';
import { wrap } from '../lib/errors.js';

const router = Router();

router.get('/', wrap(async (_req, res) => {
  const { rows } = await query(`SELECT id, name FROM categories WHERE is_active = TRUE ORDER BY name ASC`);
  res.json({ data: rows.map((row) => ({ categoryId: row.id, name: row.name, isActive: true })) });
}));

export default router;
