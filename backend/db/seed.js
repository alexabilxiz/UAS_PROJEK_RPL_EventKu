// Data awal: admin, kategori, organisasi. Contoh event/akun hanya dibuat bila SEED_DEMO=true.
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { closePool, getPool } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';
import { migrate } from './migrate.js';

const CATEGORIES = ['Workshop', 'Seminar', 'Kompetisi'];

export async function seed(pool = getPool(), env = process.env) {
  await migrate(pool);
  await seedData(pool, env);
}

/** Hanya data (tanpa DDL); aman dijalankan berulang karena setiap baris dicek dulu. */
export async function seedData(pool = getPool(), env = process.env) {
  const q = (text, params) => pool.query(text, params);

  for (const name of CATEGORIES) {
    const exists = await q(`SELECT 1 FROM categories WHERE LOWER(name) = $1`, [name.toLowerCase()]);
    if (!exists.rows.length) await q(`INSERT INTO categories (id, name, is_active) VALUES ($1, $2, TRUE)`, [randomUUID(), name]);
  }

  const adminEmail = (env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail) {
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 8) throw new Error('ADMIN_PASSWORD minimal 8 karakter.');
    const exists = await q(`SELECT 1 FROM users WHERE email = $1`, [adminEmail]);
    if (!exists.rows.length) {
      await q(
        `INSERT INTO users (id, name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, 'admin', 'active')`,
        [randomUUID(), env.ADMIN_NAME || 'Admin EventKu', adminEmail, await hashPassword(env.ADMIN_PASSWORD)],
      );
      console.log(`Admin dibuat: ${adminEmail}`);
    }
  } else {
    console.log('ADMIN_EMAIL belum diisi; akun admin tidak dibuat.');
  }

  if (env.SEED_DEMO === 'true') await seedDemo(q);
}

async function seedDemo(q) {
  const password = await hashPassword('EventKuDemo123!');
  const orgs = [
    ['Komunitas Kampus', 'verified'],
    ['Komunitas Mahasiswa Baru', 'pending'],
  ];
  const orgIds = [];
  for (const [name, status] of orgs) {
    const found = await q(`SELECT id FROM organizations WHERE name = $1`, [name]);
    if (found.rows.length) { orgIds.push(found.rows[0].id); continue; }
    const id = randomUUID();
    await q(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, $3)`, [id, name, status]);
    orgIds.push(id);
  }
  const users = [
    ['Mahasiswa UKWMS Demo', 'mahasiswa@demo.test', 'mahasiswa', true, null],
    ['Mahasiswa Kampus Lain Demo', 'mahasiswa.luar@demo.test', 'mahasiswa', false, null],
    ['Penyelenggara Demo', 'penyelenggara@demo.test', 'penyelenggara', false, orgIds[0]],
    ['Penyelenggara Baru Demo', 'penyelenggara.baru@demo.test', 'penyelenggara', false, orgIds[1]],
    ['Admin Demo', 'admin@demo.test', 'admin', false, null],
  ];
  for (const [name, email, role, ukwms, organizationId] of users) {
    const exists = await q(`SELECT 1 FROM users WHERE email = $1`, [email]);
    if (exists.rows.length) continue;
    await q(
      `INSERT INTO users (id, name, email, password_hash, role, status, ukwms_verified, organization_id)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)`,
      [randomUUID(), name, email, password, role, ukwms, organizationId],
    );
  }
  const categories = (await q(`SELECT id, name FROM categories`)).rows;
  const existing = await q(`SELECT COUNT(*) AS total FROM events WHERE organization_id = $1`, [orgIds[0]]);
  if (existing.rows[0].total > 0) return;
  for (let index = 0; index < 6; index++) {
    const category = categories[index % categories.length];
    const start = new Date(Date.now() + (index + 2) * 86_400_000);
    await q(
      `INSERT INTO events (id, organization_id, category_id, title, description, start_at, end_at, location_or_link,
         poster_url, registration_mode, quota, reserved_seats, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'https://example.org/poster.png', 'internal', 25, 0, 'disetujui')`,
      [randomUUID(), orgIds[0], category.id, `${category.name} Contoh ${index + 1}`,
        `Contoh kegiatan kampus untuk mencoba katalog dan pendaftaran (${category.name}).`,
        start, new Date(start.getTime() + 7_200_000), 'Aula Kampus Pakuwon'],
    );
  }
  console.log(`Data demo dibuat. ID organisasi menunggu verifikasi: ${orgIds[1]}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seed().then(() => console.log('Seed selesai.')).catch((error) => {
    console.error('Seed gagal:', error.message);
    process.exitCode = 1;
  }).finally(closePool);
}
