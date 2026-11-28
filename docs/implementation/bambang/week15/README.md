# Implementasi Bambang Minggu 15

Bambang Herlambang · 5803024019 · System Architect & Frontend Developer · 27 November 2026

Halaman 16 *Rincian Pekerjaan Individu Mingguan - Proyek EventKu* menugaskan Bambang memastikan build frontend production berjalan optimal untuk deployment static assets serta menulis dokumentasi teknis arsitektur dan frontend.

## Pekerjaan yang Diselesaikan

1. **Perbaikan integrasi pasca-QA/UAT (commit `dccaa91` & `05b87b5`):**
   - Menambahkan pemanggilan `POST /api/v1/auth/logout` pada `authService.js` dan `AuthContext.jsx` (perbaikan sisi klien `BUG-01`, lengkap dengan dukungan backend dan demo).
   - Menyelaraskan dukungan verifikasi akun penyelenggara `pending` pada `AdminToolsPage.jsx`, `LoginPage.jsx`, `workspaceService.js`, dan urutan `GET /admin/users` (`BUG-02`).
2. **Deployment Produksi Full-Stack Cloudflare Workers + Neon PostgreSQL (commit `8b451d0`, `0e8c3bf`, & `de1e74f`):**
   - **URL Produksi Live:** https://uas-projek-rpl-eventku.yuhugelo4.workers.dev (Version ID `f4879fc2-106c-420f-b43e-f94914a02fc9`).
   - **Swagger UI Live:** https://uas-projek-rpl-eventku.yuhugelo4.workers.dev/api-docs/ (aset statis self-hosted dibangun lewat [scripts/build-swagger-assets.mjs](../../../../scripts/build-swagger-assets.mjs) tanpa CDN eksternal dan 0 CPU Worker).
   - [wrangler.jsonc](../../../../wrangler.jsonc) & [package.json](../../../../package.json) — 1 Worker terpadu menyajikan Workers Static Assets (`frontend/dist`, SPA fallback, + `/api-docs/*`) dan API Worker (`run_worker_first: ["/api/*", "/health"]`), Smart Placement, serta Cron Trigger `*/5 * * * *`.
   - [backend/src/worker.js](../../../../backend/src/worker.js), [backend/src/lib/password.js](../../../../backend/src/lib/password.js), [backend/src/lib/iconvWorkerShim.js](../../../../backend/src/lib/iconvWorkerShim.js), & [backend/src/lib/noopWorkerShim.js](../../../../backend/src/lib/noopWorkerShim.js) — adapter Express `cloudflare:node` (`httpServerHandler`), `@neondatabase/serverless` (`poolQueryViaFetch: true` + pool per-request `AsyncLocalStorage`), Web Crypto PBKDF2-SHA256 untuk batas CPU Workers Free Plan, serta shim ringan agar bundle Worker tetap ringkas (**304,79 KiB** gzip).
3. **Dokumentasi Teknis Arsitektur & Frontend + Diagram Lucidchart Final (*As-Built*):**
   - [DOKUMENTASI_TEKNIS_ARSITEKTUR_FRONTEND.md](DOKUMENTASI_TEKNIS_ARSITEKTUR_FRONTEND.md) — merinci arsitektur Modular Monolith + React SPA, struktur modul frontend, peta rute RBAC, kontrak API & keamanan sesi, implementasi deployment **Cloudflare Workers + Neon PostgreSQL** (termasuk Swagger UI Live), dan hasil verifikasi.
   - **Lucidchart Final (*As-Built*, View only):** [EventKu — Arsitektur & ERD Final](https://lucid.app/lucidchart/1e49cea3-1463-4e91-8273-05b652e5e93a/edit?invitationId=inv_abe0894b-1d2e-4a6b-aab0-2bc4c06a2120) — menambahkan Tab 13 (*Arsitektur Produksi Final*) dan Tab 14 (*ERD Aktual 17 Tabel* sesuai `backend/db/schema.sql`) tanpa mengubah dokumen perancangan UTS (`00`–`12`).

## Hasil Verifikasi Lokal & Produksi Live

Rincian lengkap tersedia di [evidence/verification.md](evidence/verification.md).

| Pemeriksaan | Hasil |
|---|---|
| `cd frontend && npm test` | 73 tes unit lulus di 7 file. |
| `cd frontend && npm run build && npm run build:swagger` | Build produksi frontend (`index-*.js` 114,70 kB gzip) + 9 berkas aset Swagger UI di `frontend/dist/api-docs/` berhasil. |
| `cd frontend && npx playwright test --workers=2` | 36 tes regresi Chromium lulus. |
| `cd frontend && npx playwright test -c playwright.demo.config.js` | 4 tes E2E demo Chromium lulus. |
| `cd backend && npm test` | 64 tes Jest lulus di 9 suite (termasuk `docs.test.js`, 61/61 UAT API, dan 17/17 `uat-retest` pada `pg-mem`; coverage 86,08% Stmts / 91,25% Lines). |
| Integrasi Penuh Lokal (`Vite + Express + PostgreSQL 18.1`) | 6/6 lulus (0 error JS): `db:migrate`, `db:seed`, 8 RSVP paralel untuk 1 kursi (`201=1`, `409=7`), BUG-01/BUG-02 live di browser, unggah poster, moderasi, kalender 360 px, dan unduh CSV (`SCRUM-16` **DONE**). |
| Runtime Worker Lokal (`npx wrangler dev`) | Lulus, ukuran bundle **304,79 KiB** gzip, `/api-docs` → `/api-docs/` + *Try it out* `/health` `200 OK`. |
| **Produksi Live (`uas-projek-rpl-eventku.yuhugelo4.workers.dev`)** | **Lulus** (0 error aplikasi, startup Worker `107 ms`): TLS valid, `/health` `200`, Neon `/categories` (3) & `/events` (13), Swagger UI Live `/api-docs/` *Try it out* `/health` & `/categories` `200`, Playwright live `1440 px` & `360 px` tanpa overflow. |

## Bukti Tampilan Produksi Live & Pelacakan Jira

- **Tiket Jira Minggu 15:** [`SCRUM-129`](https://eventku.atlassian.net/browse/SCRUM-129) (**Done** — `[M15] Build production, deploy Cloudflare Workers, Swagger UI live, dan dokumentasi teknis arsitektur & frontend`; seluruh 30 tiket Bambang berstatus Done, 0 terbuka).
- [Katalog publik live desktop 1440 px](evidence/produksi-katalog-desktop-1440.png)
- [Katalog publik live mobile 360 px](evidence/produksi-katalog-mobile-360.png)
- [Kalender event bulanan live (`/events/calendar`)](evidence/produksi-kalender-desktop-1440.png)
- [Swagger UI Live (`/api-docs/`) & Try it out `GET /health`](evidence/produksi-swagger-live-1440.png)
- [Diagram Arsitektur Produksi Final — Ekspor Lucidchart 300 PPI (Tab 13)](evidence/arsitektur-produksi-final-lucidchart.png)
- [Diagram ERD Aktual 17 Tabel — Ekspor Lucidchart 300 PPI (Tab 14)](evidence/erd-aktual-17-tabel-lucidchart.png)
- [Dokumen Lucidchart Final (*As-Built*, View only)](https://lucid.app/lucidchart/1e49cea3-1463-4e91-8273-05b652e5e93a/edit?invitationId=inv_abe0894b-1d2e-4a6b-aab0-2bc4c06a2120)

## Tindak Lanjut Menuju Minggu 16

URL produksi live beserta Swagger UI Live sudah aktif dan siap digunakan oleh Dustin & Alexa untuk sesi simulasi end-to-end / UAT bersama 3–5 pengguna nyata (Bagian 23 Laporan Akhir), Audrey untuk pengecekan stabilitas & dokumentasi backend/API, serta persiapan *final check* dan demo presentasi UAS Minggu 16. *(Catatan: jika penguji pada ISP/WiFi tertentu di Indonesia mendapati blokir DNS terhadap `*.workers.dev`, aktifkan Secure DNS Cloudflare `1.1.1.1` atau hubungkan custom domain pada tab Domains Worker.)*
