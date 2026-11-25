# Dokumentasi Teknis Arsitektur dan Frontend — EventKu

**Proyek:** EventKu — Website Kumpulan dan Pendaftaran Event Kampus (INF300 Rekayasa Perangkat Lunak)  
**Penyusun:** Bambang Herlambang (5803024019 — System Architect & Frontend Developer)  
**Kelompok:** Kelompok IV (Audrey Elizabeth Gracesia, Bambang Herlambang, Dustin Pranata Wangsawidjaja, Alexa Bilxiz Aulia)  
**Tanggal:** 25 November 2026 (Minggu 14–15 — Situs Produksi Live)  
**Acuan Kode:** Branch `main`, commit `0e8c3bf` (Cloudflare Workers full-stack + Neon PostgreSQL)  
**URL Produksi Live:** https://uas-projek-rpl-eventku.yuhugelo4.workers.dev (Version ID: `862f7ed6-e4ca-4d32-a3a1-325f9a47e065`)

---

## 1. Ikhtisar Arsitektur Sistem

EventKu menerapkan arsitektur **Modular Monolith** di sisi backend (`backend/`, Express.js) yang berkomunikasi melalui **REST API JSON (`/api/v1`)** dengan **Single Page Application (SPA)** di sisi frontend (`frontend/`, React 19 + Vite 8 + Tailwind CSS v4), serta basis data relasional **PostgreSQL (Neon)**. Pada tahap persiapan deployment, target hosting dikonsolidasikan dari rencana awal UTS (Vercel + Render) menjadi **Cloudflare Workers** (Workers Static Assets + Workers API) + **Neon PostgreSQL**.

```
[Browser Pengguna]
        │ HTTPS (Same-Origin)
        ▼
[Cloudflare Workers — Static Assets (Frontend SPA)]
  React 19 + React Router 7 + Vite 8 + Tailwind CSS v4
  - AuthContext + sessionStorage/localStorage (Bearer JWT)
  - Services layer (apiClient.js -> /api/v1/*)
        │ Routing /api/* & /health (run_worker_first)
        ▼
[Cloudflare Workers — Backend API (Modular Monolith, nodejs_compat)]
  Express.js (adapter Workers) + Helmet + CORS + JWT + Cloudflare Rate Limiting
  - Modul Auth & Sesi       (/api/v1/auth)
  - Modul Event & Moderasi  (/api/v1/events, /api/v1/organizer, /api/v1/admin, /api/v1/categories, /api/v1/assets)
  - Modul Pendaftaran/RSVP  (/api/v1/events/:id/registrations, /api/v1/registrations)
  - Modul Notifikasi & Minat(/api/v1/notifications, /api/v1/student)
  - Health Check            (GET /health)
        │ SQL Berparameter + Transaksi Atomik (TLS via Hyperdrive / Neon Serverless)
        ▼
[Neon PostgreSQL]
  users, organizations, sessions, password_resets, categories,
  events, registrations, moderation_history, organizer_notifications,
  student_notifications, student_interests, favorites, reviews, posters
```

### Prinsip Arsitektur Utama
1. **Otoritas Tunggal di Server:** Penjaga rute (`RoleRoute`) dan tampilan kondisional di frontend hanya mengatur pengalaman pengguna. Seluruh pemeriksaan autentikasi (JWT + tabel `sessions`), peran (RBAC), status akun (`active`/`pending`/`disabled`), verifikasi organisasi, dan kepemilikan event tetap ditegakkan di backend.
2. **Pemisahan Lapisan Frontend (MVC/Layered):**
   - **View (`pages/`, `components/`):** Merender UI, status loading/kosong/gagal, dan formulir.
   - **Controller/Koordinator Aksi (`hooks/`, `context/`):** Mengatur siklus sesi, pembatalan request (`AbortController`), penguncian submit ganda, dan pembaruan state daftar.
   - **Transport & Kontrak (`services/`):** Normalisasi respons API, validasi kontrak JSON, dan pemetaan error (`ApiError`) agar halaman tidak bergantung langsung pada bentuk mentah respons server.
3. **Integritas RSVP dan Data:** Reservasi kuota dilakukan secara atomik pada transaksi database dengan `UNIQUE(event_id, user_id)` dan `CHECK (reserved_seats >= 0)`. Di frontend, `EventRegistration.jsx` mewajibkan pemeriksaan ulang status pendaftaran bila respons kiriman RSVP tidak pasti (mis. `503`/jaringan terputus) atau konflik (`409`).

---

## 2. Struktur Proyek Frontend (`frontend/`)

| Jalur | Tanggung Jawab | Berkas Utama |
|---|---|---|
| `src/App.jsx`, `src/main.jsx` | Definisi seluruh rute SPA, scroll-to-top, dan pembungkus `AuthProvider` + `BrowserRouter`. | `App.jsx`, `main.jsx` |
| `src/routes/` | Penjaga rute berdasarkan status login dan peran dari `/auth/me`. | `RoleRoute.jsx` |
| `src/context/` | State sesi global, verifikasi `/auth/me`, pencabutan sesi ke server (`POST /auth/logout`), dan sinkronisasi logout lintas tab. | `AuthContext.jsx`, `sessionStorage.js` |
| `src/hooks/` | Hook reusable untuk autentikasi, aksi formulir aman, dan pemuatan daftar berpaginasi. | `useAuth.js`, `useFormAction.js`, `useWorkspaceList.js` |
| `src/services/` | Klien HTTP terpusat dan layanan per domain fitur. | `apiClient.js`, `authService.js`, `eventService.js`, `calendarService.js`, `eventSubmissionService.js`, `eventModerationService.js`, `registrationService.js`, `workspaceService.js` |
| `src/pages/` | Halaman publik, autentikasi, mahasiswa, penyelenggara, dan admin. | 21 berkas halaman (lihat Bagian 3) |
| `src/components/` | Komponen UI bersama: tata letak, navigasi, poster aman, kartu RSVP, favorit, form pengajuan, dan workspace. | `PageShell.jsx`, `AuthLayout.jsx`, `EventPoster.jsx`, `EventRegistration.jsx`, `EventFavorite.jsx`, `EventSubmissionFields.jsx`, `WorkspacePage.jsx`, `FormField.jsx`, `PasswordField.jsx`, `Brand.jsx`, `Icon.jsx` |
| `src/utils/` | Validasi input, pemformatan tanggal/jam **WIB (`Asia/Jakarta`)**, kalkulasi grid kalender bulanan, dan sanitasi URL. | `auth.js`, `events.js`, `calendar.js`, `eventSubmission.js` |
| `src/styles/` | Gaya modular per domain + `src/styles.css` (Tailwind CSS v4, responsif mulai **320–360 px** hingga desktop **1440 px**). | `event-catalog.css`, `event-calendar.css`, `event-registration.css`, `event-submission.css`, `event-moderation.css`, `workspace.css` |
| `demo/` | Server middleware demo lokal (`npm run dev:demo`) dengan akun contoh untuk pengujian UI mandiri. | `eventkuDemo.js`, `accountActions.js`, `studentActivity.js`, `posterAssets.js`, `participantsCsv.js` |
| `e2e/`, `demo-e2e/` | Pengujian browser otomatis Playwright (Chromium). | `auth.spec.js`, `events.spec.js`, `calendar.spec.js`, `frontend-flows.spec.js` |

---

## 3. Peta Rute dan Hak Akses (RBAC)

| Rute | Akses | Halaman (`src/pages/`) | Fungsi Utama |
|---|---|---|---|
| `/` | Publik | `HomePage.jsx` | Beranda ringkas dan navigasi ke katalog/kalender. |
| `/events` | Publik | `EventCatalogPage.jsx` | Katalog event `disetujui`, pencarian kata kunci, filter kategori/penyelenggara/tanggal WIB, paginasi. |
| `/events/calendar` | Publik | `EventCalendarPage.jsx` | Kalender bulanan WIB, pemilihan tanggal, filter kategori, penanda event terdaftar (jika login mahasiswa). |
| `/events/:eventId` | Publik / Pemilik | `EventDetailPage.jsx` + `EventRegistration.jsx` | Detail event, sisa kuota, tombol RSVP/batal (mahasiswa UKWMS terverifikasi), favorit, dan tautan pendaftaran eksternal. |
| `/login`, `/register` | Publik | `LoginPage.jsx`, `RegisterPage.jsx` | Masuk (dengan opsi *Ingat saya*) dan registrasi mahasiswa atau penyelenggara (wajib `organizationId`, status awal `pending`). |
| `/bantuan-akun`, `/atur-ulang-kata-sandi` | Publik | `AccountHelpPage.jsx` (`ResetPasswordPage`) | Permintaan dan eksekusi pemulihan kata sandi. |
| `/dashboard`, `/akun/pengaturan` | Semua peran login | `AccountPage.jsx`, `AccountSettingsPage.jsx` | Ringkasan profil/peran, ubah profil (nama/foto HTTPS), dan ganti kata sandi. |
| `/mahasiswa`, `/mahasiswa/pendaftaran` | `mahasiswa` | `AccountPage.jsx`, `RegistrationsPage.jsx` | Daftar pendaftaran aktif (*mendatang*) dan *riwayat* beserta pembatalan sebelum waktu mulai. |
| `/mahasiswa/minat`, `/mahasiswa/notifikasi`, `/mahasiswa/favorit`, `/mahasiswa/ulasan/:eventId` | `mahasiswa` | `StudentActivityPage.jsx` | Kategori minat, preferensi email, notifikasi in-app, daftar favorit, dan ulasan event selesai. |
| `/penyelenggara`, `/penyelenggara/event`, `/penyelenggara/event/ajukan` | `penyelenggara` | `AccountPage.jsx`, `OrganizerEventsPage.jsx`, `EventSubmissionPage.jsx` | Daftar event organisasi, simpan draft, unggah poster (JPG/PNG/WebP ≤ 2 MB), dan pengajuan moderasi. |
| `/penyelenggara/event/:eventId/kelola`, `/penyelenggara/event/:eventId/peserta` | `penyelenggara` | `OrganizerManageEventPage.jsx`, `EventParticipantsPage.jsx` | Edit/batalkan event (dengan kontrol versi optimistik), daftar peserta aktif, dan ekspor CSV. |
| `/penyelenggara/notifikasi`, `/penyelenggara/statistik` | `penyelenggara` | `OrganizerNotificationsPage.jsx`, `WorkspaceStatisticsPage.jsx` | Notifikasi hasil moderasi dan statistik okupansi/tren pendaftaran organisasi. |
| `/admin`, `/admin/moderasi`, `/admin/moderasi/riwayat`, `/admin/moderasi/tayang` | `admin` | `AccountPage.jsx`, `EventModerationPage.jsx`, `AdminToolsPage.jsx` | Antrean moderasi (setujui/tolak dengan alasan wajib), riwayat keputusan, dan penurunan (*unpublish*) event tayang. |
| `/admin/organisasi`, `/admin/kategori`, `/admin/pengguna`, `/admin/statistik` | `admin` | `AdminOrganizationsPage.jsx`, `AdminCategoriesPage.jsx`, `AdminToolsPage.jsx`, `WorkspaceStatisticsPage.jsx` | Verifikasi/penangguhan organisasi, CRUD kategori, verifikasi akun penyelenggara `pending` & nonaktifkan/aktifkan pengguna, serta statistik platform. |

*(Rute `/mahasiswa/email-demo` hanya aktif ketika `import.meta.env.DEV && import.meta.env.MODE === 'demo'` dan otomatis dibuang dari bundel produksi.)*

---

## 4. Manajemen Sesi, Keamanan Klien, dan Kontrak API

### 4.1 Klien HTTP (`src/services/apiClient.js`)
- **Validasi konfigurasi runtime:** `normalizeBaseUrl` menolak protokol `http://` non-lokal, kredensial pada URL, maupun path traversal (`..`). Pada produksi wajib HTTPS atau path relatif (`/api/v1`).
- **Transport aman:** Menggunakan `credentials: 'omit'` dan mengirim token melalui header `Authorization: Bearer <token>`, dilengkapi timeout **12 detik**, pembatalan via `AbortController`, serta validasi `Content-Type` JSON.
- **Pesan error aman:** Status `400/401/403/404/409/422/429/5xx` dipetakan ke pesan berbahasa Indonesia yang ramah pengguna tanpa membocorkan detail stack trace server; `fieldErrors` pada `422` disaring melalui daftar bidang yang diizinkan (`FIELD_MESSAGES`).

### 4.2 Alur Sesi & Keamanan Pasca Perbaikan `BUG-01` & `BUG-02`
1. **Verifikasi Profil Otoritatif:** Setelah `POST /auth/login`, `AuthContext` selalu memanggil `GET /auth/me` sebelum menyimpan token dan menetapkan peran; metadata peran dari payload login tidak dipercaya sepihak.
2. **Penyimpanan Token & Sinkronisasi Tab:** Login standar disimpan di `sessionStorage` (terisolasi per tab), sedangkan *Ingat saya* disimpan di `localStorage` dan disinkronkan lewat `StorageEvent` lintas tab.
3. **Logout Server-Side (`BUG-01`):** Saat `logout()` dipanggil, `AuthContext` langsung membersihkan state & storage lokal sekaligus mengirim `POST /api/v1/auth/logout` dengan token aktif agar backend menghapus baris `sessions` terkait (`jti`). Token lama otomatis ditolak `401` oleh server.
4. **Verifikasi Penyelenggara Baru (`BUG-02`):** Pendaftaran peran `penyelenggara` membuat akun dengan `status: 'pending'`. Login ditolak `403` oleh server hingga admin menyetujui akun melalui halaman `/admin/pengguna` (`PATCH /api/v1/admin/users/:userId` dengan `{ status: 'active' }`).
5. **Sanitasi URL & XSS:** React melakukan escape teks secara bawaan; tautan poster dan pendaftaran eksternal disaring melalui `safeEventPoster` (hanya path relatif `/...` atau `https://`) dan `safeRegistrationUrl` (hanya `https://`).

### 4.3 Pemetaan Service Frontend ke Endpoint Backend (`/api/v1`)
- **`authService.js`:** `POST /auth/login`, `POST /auth/logout`, `POST /auth/register`, `GET /auth/me`, `PATCH /auth/me/profile`, `PATCH /auth/me/password`, `POST /auth/forgot-password`, `POST /auth/reset-password`.
- **`eventService.js` & `calendarService.js`:** `GET /categories`, `GET /events` (filter `q`, `category`, `organizer`, `date`, `from`, `to`, `page`, `limit`), `GET /events/:eventId`.
- **`eventSubmissionService.js`:** `POST /assets/posters`, `POST /events`, `PATCH /events/:eventId/submit`, `GET /organizer/events/:eventId`, `PATCH /organizer/events/:eventId`.
- **`eventModerationService.js`:** `GET /admin/events/moderation`, `PATCH /admin/events/moderation/:eventId`.
- **`registrationService.js`:** `POST /events/:eventId/registrations`, `DELETE /registrations/:registrationId`, `GET /registrations/me`.
- **`workspaceService.js`:** `GET /organizer/events`, `GET /organizer/events/:eventId/participants` (+ `?format=csv`), `GET /organizer/statistics`, `GET/PATCH /notifications/me*`, `GET/PUT /student/*`, `GET/POST/PATCH /admin/*`.

---

## 5. Build Produksi dan Panduan Deployment (Cloudflare Workers + Neon PostgreSQL)

### 5.1 Prasyarat & Perintah Build Lokal
- **Node.js:** minimal `>= 22.12.0` (`engines.node` di `frontend/package.json` dan `backend/package.json`; untuk Cloudflare CLI `cf`, disarankan `>= 22.18.0`).
- **Build produksi frontend:**
  ```powershell
  cd frontend
  npm ci
  npm run build
  ```
- **Keluaran aktual build (`frontend/dist/`):**
  - `dist/index.html` (~0,68 kB; gzip ~0,41 kB)
  - `dist/assets/index-*.css` (~35,5 kB; gzip ~8,1 kB)
  - `dist/assets/index-*.js` (~392 kB; gzip ~114,7 kB)
- **Pratinjau hasil build lokal:** `npm run preview` (setelah `npm run build`).

### 5.2 Arsitektur Deployment Cloudflare Workers (Static Assets + Workers API — Live)
Aplikasi di-deploy sebagai **satu Worker terpadu** (`uas-projek-rpl-eventku`, live pada https://uas-projek-rpl-eventku.yuhugelo4.workers.dev) sehingga frontend SPA (`frontend/dist`) dan backend API (`/api/v1/*`) berjalan pada **satu origin yang sama**:

1. **Konfigurasi Root (`wrangler.jsonc` & `package.json`):**
   - [wrangler.jsonc](../../../../wrangler.jsonc) menunjuk `main: "backend/src/worker.js"`, `compatibility_date: "2026-04-01"`, `compatibility_flags: ["nodejs_compat"]`, `placement: { "mode": "smart" }`, dan `triggers: { "crons": ["*/5 * * * *"] }`.
   - Workers Static Assets diarahkan ke `frontend/dist` dengan `not_found_handling: "single-page-application"` dan `run_worker_first: ["/api/*", "/health"]`. Dengan `VITE_API_BASE_URL` bawaan `/api/v1` (same-origin), tidak ada preflight CORS lintas domain dan poster unggahan (`/api/v1/assets/posters/<uuid>`) tampil dari origin yang sama.
   - Modul `iconv-lite` (ketergantungan Express 4) di-alias ke [backend/src/lib/iconvWorkerShim.js](../../../../backend/src/lib/iconvWorkerShim.js) berbasis `TextDecoder` agar bundle `workerd` bersih dan ringkas (**304,4 KiB** gzip).
2. **Adaptasi Backend Express di Cloudflare Workers (`backend/src/worker.js`):**
   - Membungkus `createApp()` Express memakai `httpServerHandler` dari `cloudflare:node` serta handler `scheduled()` untuk menjalankan `runScheduledJobs()` lewat Cron Trigger setiap 5 menit.
   - Koneksi ke **Neon PostgreSQL** memakai driver resmi **`@neondatabase/serverless`** dengan pool per-request terisolasi melalui `AsyncLocalStorage` ([backend/src/db.js](../../../../backend/src/db.js)) dan `neonConfig.poolQueryViaFetch = true` (query tunggal memakai 1 roundtrip HTTP fetch, transaksi RSVP memakai WebSocket interaktif penuh, ditutup bersih via `ctx.waitUntil(pool.end())`). Tidak memerlukan binding Hyperdrive tambahan.
   - Hashing kata sandi ([backend/src/lib/password.js](../../../../backend/src/lib/password.js)) otomatis memakai **Web Crypto PBKDF2-SHA256** native (`100.000` iterasi) di Cloudflare Workers agar aman terhadap batas CPU 10 ms Workers Free Plan, sambil tetap kompatibel memverifikasi hash `bcrypt` lama.
3. **Perintah Build & Deploy serta Secrets (jangan simpan di Git):**
   ```powershell
   npm run build        # install backend & frontend lalu build frontend/dist
   npx wrangler deploy  # unggah aset statis & Worker ke Cloudflare
   ```
   | Secret / Variabel | Wajib | Keterangan |
   |---|---|---|
   | `DATABASE_URL` | Ya (Secret) | Connection string pooled Neon PostgreSQL (`?sslmode=require`) |
   | `JWT_SECRET` | Ya (Secret) | Minimal 32 karakter acak (256-bit) |
   | `CORS_ORIGINS` / `FRONTEND_URL` | Opsional | Otomatis memakai origin Worker (`https://uas-projek-rpl-eventku.yuhugelo4.workers.dev`) bila tidak diisi |
   | `UKWMS_EMAIL_DOMAINS` | Opsional | Bawaan `student.ukwms.ac.id` |

### 5.3 Migrasi & Seed Database (Neon PostgreSQL)
Migrasi skema dan data awal pada database Neon PostgreSQL produksi sudah terpasang (`Kompetisi`, `Seminar`, `Workshop`, dan 10 event aktif). Bila perlu menjalankan ulang dari mesin lokal mengarah ke `DATABASE_URL` Neon:
```powershell
cd backend
$env:PASSWORD_HASH_ALGO = "pbkdf2"
npm run db:migrate
npm run db:seed
```

### 5.4 Checklist Verifikasi Pascadeploy (URL Live Cloudflare Workers)
- [x] Hard refresh pada rute nested (`/events/calendar`) menyajikan `index.html` (`200 OK`, tertangani `not_found_handling: "single-page-application"`).
- [x] Request `/health` (`200 OK`, ~273 ms) dan `/api/v1/*` langsung masuk ke Worker backend (`run_worker_first`); `/api/v1/categories` (3 kategori) dan `/api/v1/events` (10 event) membaca Neon PostgreSQL asli.
- [x] Verifikasi TLS HTTPS (`Let's Encrypt YE1`, valid hingga Feb 2027), header `x-content-type-options: nosniff`, `POST /api/v1/auth/login` PBKDF2 (~836 ms), dan blokir CORS lintas origin (`https://evil.test`).
- [x] Uji tampilan live Playwright desktop `1440 px` dan mobile `360 px` pada `/events` & `/login` tanpa overflow horizontal dan 0 error aplikasi (`Bukti QA-04` & `Bukti QA-05`).
- [ ] Sesi UAT tulis end-to-end bersama 3–5 penguji nyata (Bagian 23 Laporan Akhir — dikoordinasikan Dustin & Alexa memakai URL live).

---

## 6. Ringkasan Verifikasi Otomatis & Live Terkini (Commit `0e8c3bf`)

| Suite Pengujian | Perintah / Target | Hasil | Keterangan |
|---|---|---|---|
| Frontend Unit (Vitest) | `cd frontend && npm test` | **73/73 lulus** (7 file) | Mencakup `apiClient`, `authService` (+`logout`), `AuthContext` (+`logout` & race condition), `calendar`, `eventSubmission`, `registrationService`. |
| Frontend Build (Vite) | `cd frontend && npm run build` | **Berhasil** | Bundel JS `114,70 kB` (gzip), tanpa error/warning. |
| Frontend Browser Regresi | `cd frontend && npx playwright test --workers=2` | **36/36 lulus** | Auth, katalog, pengajuan, RSVP, kalender, responsif 320/360/1440 px terhadap fixture kontrak API. |
| Frontend Browser Demo E2E | `cd frontend && npx playwright test -c playwright.demo.config.js` | **4/4 lulus** | Alur multi-peran lengkap (mahasiswa, penyelenggara, admin) pada server demo lokal. |
| Backend Jest + UAT API | `cd backend && npm test` | **62/62 lulus** (8 file) | `api-security`, `auth`, `frontend-contract`, `seed`, `uat-flow`, `uat-extra`, `uat-rate`, `uat-retest` (17/17). Menggunakan `pg-mem`. |
| Integrasi Penuh Lokal (PG 18.1) | Playwright live terhadap Vite + Express + PostgreSQL 18.1 | **6/6 lulus** (0 error JS) | `db:migrate`, `db:seed`, konkurensi nyata 8 RSVP paralel untuk 1 kursi (`201=1`, `409=7`), BUG-01/BUG-02 live di browser, unggah poster, moderasi, kalender 360 px, ekspor CSV (`SCRUM-16` **DONE**). |
| Runtime Worker Lokal (`workerd`) | `npx wrangler dev` + `--dry-run` | **6/6 lulus** | Bundle **304,4 KiB** gzip; `/health`, SPA fallback, `run_worker_first`, Express + CORS + Worker rate limiter lulus. |
| **Produksi Live (Cloudflare + Neon)** | `https://uas-projek-rpl-eventku.yuhugelo4.workers.dev` | **6/6 lulus** (0 error aplikasi) | TLS valid, `/health` 273 ms, Neon `/categories` (3) & `/events` (10), auth PBKDF2 + CORS + `nosniff`, Playwright live `1440 px` & `360 px` tanpa overflow (`Bukti QA-04` & `QA-05`). |

*Catatan batas pengujian:* Deployment produksi live (**Cloudflare Workers + Neon PostgreSQL**) telah aktif dan diverifikasi; UAT bersama 3–5 pengguna nyata (Bagian 23 Laporan Akhir) serta penyiapan slide/presentasi akhir tetap menjadi tahap penyelesaian tim pada Minggu 14–16.
