import { HttpError } from '../lib/errors.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      message: error.message,
      ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
    });
  }
  // Kesalahan body-parser: JSON rusak atau terlalu besar.
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Body JSON tidak valid.' });
  if (error?.type === 'entity.too.large') return res.status(413).json({ message: 'Payload terlalu besar.' });
  // Pelanggaran unique (mis. email dobel akibat dua request bersamaan).
  if (error?.code === '23505') return res.status(409).json({ message: 'Data sudah ada.' });
  if (process.env.NODE_ENV !== 'test') console.error(`${req.method} ${req.path}:`, error);
  return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
}
