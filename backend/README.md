# Backend EventKu

REST API untuk frontend di folder `../frontend`. Node.js 22+, Express 4, PostgreSQL (Neon), JWT, bcrypt.
Kontrak endpoint mengikuti `frontend/src/services/*` dan bagian "Demo lokal" di `frontend/README.md`.

## Menjalankan

```bash
cd backend
npm ci
cp .env.example .env        # isi DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:migrate          # membuat tabel (aman diulang: CREATE TABLE IF NOT EXISTS)
npm run db:seed             # kategori awal + akun admin dari .env (SEED_DEMO=true menambah data contoh)
npm run dev                 # http://localhost:3000/api/v1
```

Frontend: `API_PROXY_TARGET=http://127.0.0.1:3000` di `frontend/.env.local` (sudah default pada `.env.example`), lalu `npm run dev` di folder `frontend`.

Postgres lokal tanpa SSL: isi `DATABASE_SSL=false`. Buat `JWT_SECRET` dengan
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## Pengujian

```bash
npm test
```

45 test (Jest + Supertest) berjalan pada PostgreSQL in-memory (`pg-mem`), tanpa perlu database sungguhan.

- `frontend-contract.test.js` menjalankan **service frontend asli** (`authService`, `eventService`, `registrationService`, `workspaceService`, dst.) terhadap server ini, sehingga bentuk respons yang dipakai UI ikut teruji.
- `api-security.test.js`: token palsu/kedaluwarsa/dicabut, pembatasan peran dan kepemilikan, ID bukan UUID, SQL injection, JSON rusak, CORS, reset sandi, scheduler.
- `seed.test.js`: seed dan idempotensinya.

Batasan `pg-mem`: tidak menjalankan `ROLLBACK`, tidak mensimulasikan transaksi paralel, dan tidak menangani `CREATE TABLE IF NOT EXISTS` pada tabel yang sudah ada. Karena itu **uji kuota dengan banyak pendaftar bersamaan dan migrasi berulang perlu dicoba di PostgreSQL/Neon sungguhan** sebelum rilis.

## Struktur

```
db/            schema.sql, migrate.js, seed.js
src/app.js     rangkaian middleware dan routing
src/routes/    auth, events, registrations, organizer, admin, notifications, student, assets, categories
src/lib/       validators (sama dengan util frontend), serializers, notify, scheduler, csv, paginasi
src/middleware auth (JWT + sesi di DB), errorHandler
tests/
```

## Endpoint (awalan `/api/v1`)

Respons daftar: `{ data, total, page }` dengan `page >= 1`, `limit <= 20`. Error: `{ message, fieldErrors? }`.

## Swagger / OpenAPI

Jalankan backend (`npm run dev`), lalu buka [Swagger UI Lokal](http://localhost:3000/api-docs/) atau akses langsung [Swagger UI Live (Produksi)](https://uas-projek-rpl-eventku.yuhugelo4.workers.dev/api-docs/) untuk menjelajahi dan mencoba endpoint langsung dari browser. Spesifikasi OpenAPI 3 yang digunakan UI tersedia di [`../docs/openapi.yaml`](../docs/openapi.yaml). Server API lokal menggunakan `http://localhost:3000/api/v1`; produksi live di `https://uas-projek-rpl-eventku.yuhugelo4.workers.dev/api/v1`; health check berada di `/health`. Endpoint terproteksi menerima JWT melalui `Authorization: Bearer <accessToken>`.

| Kelompok | Endpoint | Akses |
|---|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | publik / login |
| | `PATCH /auth/me/profile`, `PATCH /auth/me/password` | login |
| | `POST /auth/forgot-password`, `POST /auth/reset-password` | publik |
| Katalog | `GET /categories`, `GET /events` (`q, category, organizer, date, from, to, page, limit`), `GET /events/:id` | publik |
| Pengajuan | `POST /events` (draft), `PATCH /events/:id/submit` | penyelenggara terverifikasi |
| RSVP | `POST /events/:id/registrations`, `GET /registrations/me?scope=upcoming\|history`, `DELETE /registrations/:id` | mahasiswa UKWMS terverifikasi |
| Penyelenggara | `GET /organizer/events`, `GET\|PATCH /organizer/events/:id`, `GET /organizer/events/:id/participants[?format=csv]`, `GET /organizer/statistics`, `GET /notifications/me`, `PATCH /notifications/me/:id/read` | penyelenggara |
| Poster | `POST /assets/posters` (Base64, maks 2 MB; JPG/PNG/WebP dicek isi file), `GET /assets/posters/:id` | penyelenggara terverifikasi / publik |
| Admin | `GET /admin/users`, `PATCH /admin/users/:id`, `GET /admin/statistics` | admin |
| | `GET /admin/organizations`, `POST /admin/organizations`, `PATCH /admin/organizations/:id` | admin |
| | `GET\|POST /admin/categories`, `PATCH /admin/categories/:id` | admin |
| | `GET /admin/events/moderation[?scope=published\|history]`, `PATCH /admin/events/moderation/:id` | admin |
| Mahasiswa | `GET /student/notifications`, `PATCH /student/notifications/:id/read`, `GET /student/demo-mail` | mahasiswa |
| | `GET\|PUT /student/interests`, `GET\|PUT /student/notification-preferences` | mahasiswa |
| | `GET /student/favorites`, `GET\|PUT\|DELETE /student/favorites/:eventId`, `GET\|PUT /student/reviews/:eventId` | mahasiswa |

`POST /admin/organizations` tidak dipakai frontend saat ini, tetapi diperlukan agar organisasi (dan ID-nya untuk registrasi penyelenggara) bisa dibuat tanpa menyentuh database.

## Aturan penting

- **Status event**: `draft → menunggu_moderasi → disetujui | ditolak`; `disetujui → selesai` otomatis setelah `endAt` (scheduler tiap 60 detik); `dibatalkan` oleh penyelenggara atau admin. Perubahan jadwal/lokasi event tayang mengembalikannya ke `menunggu_moderasi` dan memberi tahu peserta.
- **Kuota**: kursi diambil dengan satu `UPDATE ... WHERE reserved_seats < quota` di dalam transaksi, sehingga tidak bisa melewati kuota walau banyak mahasiswa mendaftar bersamaan. Pendaftar yang kalah mendapat 409.
- **Konkurensi penyuntingan**: `PATCH /organizer/events/:id` membutuhkan `expectedStatus` dan `expectedVersion`; versi usang menghasilkan 409.
- **Sesi**: JWT berisi `jti` yang juga disimpan di tabel `sessions`. Menonaktifkan akun, reset sandi, dan ganti sandi (untuk perangkat lain) langsung mencabut token lama. Tidak ada refresh token; masa berlaku default 8 jam.
- **Keamanan**: bcrypt, rate limit 30 request / 15 menit pada endpoint auth, helmet, CORS dibatasi `CORS_ORIGINS`, semua query berparameter, body JSON maks 64 KB, jawaban lupa-sandi sama untuk email terdaftar maupun tidak.

## Asumsi dan hal yang belum selesai

1. **Verifikasi UKWMS** (`ukwmsVerified`) saat ini hanya berdasarkan domain email saat mendaftar (`UKWMS_EMAIL_DOMAINS`, default `student.ukwms.ac.id`). Domain itu tebakan; ganti sesuai domain sebenarnya. Karena email belum dikonfirmasi lewat tautan, ini **belum membuktikan** pemilik email adalah mahasiswa. Pembuktian sungguhan butuh verifikasi email atau data dari kampus.
2. **Email belum terkirim.** Tautan reset sandi hanya dicetak ke log server saat `NODE_ENV` bukan production, dan "email" notifikasi hanya masuk tabel `email_outbox` (dibaca `/student/demo-mail`). Untuk production, sambungkan penyedia SMTP/email di `lib/notify.js` dan `routes/auth.js`.
3. **Poster unggahan** diserahkan sebagai path relatif `/api/v1/assets/posters/:id`. Jika frontend dan API berbeda host (`VITE_API_BASE_URL` absolut), gambar akan gagal dimuat kecuali ada reverse proxy `/api/v1` pada host frontend. Poster disimpan sebagai Base64 di database (cukup untuk skala kampus; pindah ke object storage bila membesar).
4. Scheduler berjalan di dalam proses server. Dengan beberapa instance, pengingat tidak ganda (dijaga primary key), tetapi sebaiknya satu instance saja yang menjalankannya bila beban bertambah.
