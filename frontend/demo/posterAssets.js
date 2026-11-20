import { randomUUID } from 'node:crypto';
import { POSTER_LIMIT, POSTER_TYPES } from '../src/utils/eventSubmission.js';

function matchesImage(bytes, type) {
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

export function posterAssets() {
  const assets = new Map();

  async function handle({ path, method, read, json, error, allows, user }, response) {
    const assetPath = /^\/assets\/posters\/([a-f0-9-]{36})$/.exec(path);
    if (assetPath && method === 'GET') {
      const asset = assets.get(assetPath[1]);
      if (!asset) error(404, 'Poster tidak ditemukan.');
      else {
        response.writeHead(200, { 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
        response.end(asset.bytes);
      }
      return true;
    }
    if (path !== '/assets/posters' || method !== 'POST') return false;
    if (!allows('penyelenggara')) return true;
    if (user.organization.status !== 'verified') {
      error(403, 'Organisasi belum terverifikasi.');
      return true;
    }
    const { type, data } = (await read(Math.ceil(POSTER_LIMIT / 3) * 4 + 1024)) ?? {};
    if (!POSTER_TYPES.includes(type) || typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      error(422, 'Poster harus berupa JPG, PNG, atau WebP.');
      return true;
    }
    const bytes = Buffer.from(data, 'base64');
    if (bytes.length > POSTER_LIMIT || !matchesImage(bytes, type)) {
      error(422, 'Format poster tidak valid atau melebihi 2 MB.');
      return true;
    }
    const assetId = randomUUID();
    assets.set(assetId, { type, bytes, organizationId: user.organization.organizationId });
    json(201, { posterUrl: `/api/v1/assets/posters/${assetId}` });
    return true;
  }

  function owned(url, organizationId) {
    const assetId = url.split('/').at(-1);
    return assets.get(assetId)?.organizationId === organizationId;
  }
  return { handle, owned };
}
