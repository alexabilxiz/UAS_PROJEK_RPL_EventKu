# Implementasi Bambang Minggu 15

Bambang Herlambang · 5803024019 · System Architect & Frontend Developer · 24 November 2026

Halaman 16 *Rincian Pekerjaan Individu Mingguan - Proyek EventKu* menugaskan Bambang memastikan build frontend production berjalan optimal untuk deployment static assets serta menulis dokumentasi teknis arsitektur dan frontend.

## Pekerjaan yang Diselesaikan

1. **Perbaikan integrasi pasca-QA/UAT (commit `dccaa91`):**
   - Menambahkan pemanggilan `POST /api/v1/auth/logout` pada `authService.js` dan `AuthContext.jsx` (perbaikan sisi klien `BUG-01`, lengkap dengan dukungan backend dan demo).
   - Menyelaraskan dukungan verifikasi akun penyelenggara `pending` pada `AdminToolsPage.jsx` dan `LoginPage.jsx` (mendukung perbaikan `BUG-02` di backend).
2. **Dokumentasi Teknis Arsitektur & Frontend:**
   - [DOKUMENTASI_TEKNIS_ARSITEKTUR_FRONTEND.md](DOKUMENTASI_TEKNIS_ARSITEKTUR_FRONTEND.md) — merinci arsitektur Modular Monolith + React SPA, struktur modul frontend, peta rute RBAC, kontrak API & keamanan sesi, panduan build serta deployment Vercel + Render + Neon, dan checklist verifikasi pascadeploy (`SCRUM-16`).
3. **Konfigurasi Deployment Siap Pakai (untuk koordinasi dengan Alexa/DevOps):**
   - [frontend/vercel.json](../../../../frontend/vercel.json) — konfigurasi build Vite, SPA fallback rewrite (tanpa menimpa `/api/*`), header keamanan, dan cache aset hashed.
   - [render.yaml](../../../../render.yaml) — blueprint Render untuk `backend/` (`npm ci`, `npm start`, health check `/health`, dan daftar environment variable tanpa menyimpan kredensial).

## Hasil Verifikasi Lokal

| Pemeriksaan | Hasil |
|---|---|
| `cd frontend && npm test` | 73 tes unit lulus di 7 file. |
| `cd frontend && npm run build` | Build produksi berhasil (`dist/assets/index-*.js` ~114,7 kB gzip). |
| `cd frontend && npx playwright test --workers=2` | 36 tes regresi Chromium lulus. |
| `cd frontend && npx playwright test -c playwright.demo.config.js` | 4 tes E2E demo Chromium lulus. |
| `cd backend && npm test` | 62 tes Jest lulus di 8 file (termasuk 61/61 UAT API dan 17/17 `uat-retest` pada `pg-mem`). |
| Integrasi Penuh Lokal (`Vite + Express + PostgreSQL 18.1`) | 6/6 lulus (0 error JS): `db:migrate`, `db:seed`, 8 RSVP paralel untuk 1 kursi (`201=1`, `409=7`), BUG-01/BUG-02 live di browser, unggah poster, moderasi, kalender 360 px, dan unduh CSV (`SCRUM-16` **DONE**). |

## Tindak Lanjut Menunggu Deploy Live

Setelah Alexa menyelesaikan deployment backend di Render/Cloudflare (terhubung ke Neon PostgreSQL) dan frontend di Vercel/Cloudflare Pages, lakukan verifikasi akhir pada URL produksi menggunakan checklist pada Bagian 5.4 [DOKUMENTASI_TEKNIS_ARSITEKTUR_FRONTEND.md](DOKUMENTASI_TEKNIS_ARSITEKTUR_FRONTEND.md) untuk persiapan final check Minggu 16.
