# Implementasi Bambang Minggu 15

Bambang Herlambang · 5803024019 · System Architect & Frontend Developer · 25 November 2026

Halaman 16 *Rincian Pekerjaan Individu Mingguan - Proyek EventKu* menugaskan Bambang memastikan build frontend production berjalan optimal untuk deployment static assets serta menulis dokumentasi teknis arsitektur dan frontend.

## Pekerjaan yang Diselesaikan

1. **Perbaikan integrasi pasca-QA/UAT (commit `dccaa91` & `05b87b5`):**
   - Menambahkan pemanggilan `POST /api/v1/auth/logout` pada `authService.js` dan `AuthContext.jsx` (perbaikan sisi klien `BUG-01`, lengkap dengan dukungan backend dan demo).
   - Menyelaraskan dukungan verifikasi akun penyelenggara `pending` pada `AdminToolsPage.jsx`, `LoginPage.jsx`, `workspaceService.js`, dan urutan `GET /admin/users` (`BUG-02`).
2. **Deployment Produksi Full-Stack Cloudflare Workers + Neon PostgreSQL (commit `8b451d0` & `0e8c3bf`):**
   - **URL Produksi Live:** https://uas-projek-rpl-eventku.yuhugelo4.workers.dev (Version ID `862f7ed6-e4ca-4d32-a3a1-325f9a47e065`).
   - [wrangler.jsonc](../../../../wrangler.jsonc) & [package.json](../../../../package.json) — 1 Worker terpadu menyajikan Workers Static Assets (`frontend/dist`, SPA fallback) + API Worker (`run_worker_first: ["/api/*", "/health"]`), Smart Placement, dan Cron Trigger `*/5 * * * *`.
   - [backend/src/worker.js](../../../../backend/src/worker.js), [backend/src/lib/password.js](../../../../backend/src/lib/password.js), [backend/src/lib/iconvWorkerShim.js](../../../../backend/src/lib/iconvWorkerShim.js) — adapter Express `cloudflare:node` (`httpServerHandler`), `@neondatabase/serverless` (`poolQueryViaFetch: true` + pool per-request `AsyncLocalStorage`), dan Web Crypto PBKDF2-SHA256 untuk batas CPU Workers Free Plan.
3. **Dokumentasi Teknis Arsitektur & Frontend:**
   - [DOKUMENTASI_TEKNIS_ARSITEKTUR_FRONTEND.md](DOKUMENTASI_TEKNIS_ARSITEKTUR_FRONTEND.md) — merinci arsitektur Modular Monolith + React SPA, struktur modul frontend, peta rute RBAC, kontrak API & keamanan sesi, implementasi deployment **Cloudflare Workers + Neon PostgreSQL**, dan hasil verifikasi live.

## Hasil Verifikasi Lokal & Produksi Live

| Pemeriksaan | Hasil |
|---|---|
| `cd frontend && npm test` | 73 tes unit lulus di 7 file. |
| `cd frontend && npm run build` | Build produksi berhasil (`dist/assets/index-*.js` ~114,7 kB gzip). |
| `cd frontend && npx playwright test --workers=2` | 36 tes regresi Chromium lulus. |
| `cd frontend && npx playwright test -c playwright.demo.config.js` | 4 tes E2E demo Chromium lulus. |
| `cd backend && npm test` | 62 tes Jest lulus di 8 file (termasuk 61/61 UAT API dan 17/17 `uat-retest` pada `pg-mem`). |
| Integrasi Penuh Lokal (`Vite + Express + PostgreSQL 18.1`) | 6/6 lulus (0 error JS): `db:migrate`, `db:seed`, 8 RSVP paralel untuk 1 kursi (`201=1`, `409=7`), BUG-01/BUG-02 live di browser, unggah poster, moderasi, kalender 360 px, dan unduh CSV (`SCRUM-16` **DONE**). |
| Runtime Worker Lokal (`npx wrangler dev`) | 6/6 lulus, ukuran bundle **304,4 KiB** gzip. |
| **Produksi Live (`uas-projek-rpl-eventku.yuhugelo4.workers.dev`)** | **6/6 lulus** (0 error aplikasi): TLS valid, `/health` 273 ms, Neon `/categories` (3) & `/events` (10), auth PBKDF2 + CORS + `nosniff` (836 ms), Playwright live `1440 px` & `360 px` tanpa overflow. |

## Tindak Lanjut Menuju Minggu 16

URL produksi live sudah aktif dan siap digunakan oleh Dustin & Alexa untuk sesi UAT bersama 3–5 pengguna nyata (Bagian 23 Laporan Akhir) serta persiapan *final check* dan demo presentasi UAS Minggu 16. *(Catatan: jika penguji pada ISP/WiFi tertentu di Indonesia mendapati blokir DNS terhadap `*.workers.dev`, aktifkan Secure DNS Cloudflare `1.1.1.1` atau hubungkan custom domain pada tab Domains Worker.)*
