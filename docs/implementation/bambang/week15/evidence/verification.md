# Verifikasi Frontend, Arsitektur, dan Deployment Produksi — Minggu 15

- **Penyusun:** Bambang Herlambang (`5803024019`) — System Architect & Frontend Developer
- **Tanggal Verifikasi:** 27 November 2026
- **Lingkungan Uji Lokal:** Windows, Node.js `v22.16.0`, npm `10.9.2`, Vitest `5.1.0`, Vite `8.3.5`, Wrangler `4.168.0`, Playwright Chromium
- **Acuan Kode:** Branch `main`, commit `de1e74f`
- **URL Produksi Live:** https://uas-projek-rpl-eventku.yuhugelo4.workers.dev
- **Swagger UI Live:** https://uas-projek-rpl-eventku.yuhugelo4.workers.dev/api-docs/
- **Cloudflare Workers Version ID:** `f4879fc2-106c-420f-b43e-f94914a02fc9`

## Ringkasan Hasil Pemeriksaan

| Pemeriksaan | Perintah / Target | Hasil |
|---|---|---|
| Unit test frontend | `cd frontend && npm test` | **73/73 lulus** (7 file, 6,92 dtk) |
| Build produksi frontend | `cd frontend && npm run build` | **Berhasil** (`dist/index.html` 0,68 kB; CSS 8,14 kB gzip; JS 114,70 kB gzip) |
| Build aset statis Swagger UI | `npm run build:swagger` | **Berhasil** (9 berkas di `frontend/dist/api-docs/`, self-hosted tanpa CDN luar) |
| Regresi browser Playwright | `cd frontend && npx playwright test --workers=2` | **36/36 lulus** (Chromium, 24,2 dtk) |
| Demo E2E multi-peran Playwright | `cd frontend && npx playwright test -c playwright.demo.config.js` | **4/4 lulus** (Chromium, 17,3 dtk) |
| Unit & UAT API backend (Jest) | `cd backend && npm test` | **64/64 lulus** (9 suite, termasuk `docs.test.js`, 61/61 UAT API, dan 17/17 `uat-retest` pada `pg-mem`) |
| White-box code coverage backend | `cd backend && npx jest --coverage` | **86,08% Statements · 75,85% Branch · 84,77% Functions · 91,25% Lines** (memenuhi `NFR-MAINT-02` ≥ 60%) |
| Integrasi penuh lokal PG 18.1 | Vite + Express asli + PostgreSQL 18.1 | **6/6 lulus** (0 error JS; migrasi/seed, konkurensi nyata 8 RSVP paralel untuk 1 kursi `201=1`/`409=7`, BUG-01/BUG-02, poster, CSV — `SCRUM-16` **DONE**) |
| Dry-run & runtime Worker lokal | `npx wrangler deploy --dry-run` & `npx wrangler dev` | **Lulus** (16 aset statis, bundle Worker **304,79 KiB** gzip, `/api-docs` → `307 /api-docs/` → `200`, *Try it out* `/health` `200`) |
| **Deployment & verifikasi live** | `https://uas-projek-rpl-eventku.yuhugelo4.workers.dev` | **Lulus** (`Version ID f4879fc2-106c-420f-b43e-f94914a02fc9`, startup Worker `107 ms`, 0 *page error*, 0 kegagalan aset *first-party*, 0 overflow 360 px & 1440 px) |

## Detail Verifikasi Produksi Live (27 November 2026)

1. **Endpoint API & Neon PostgreSQL Live:**
   - `GET /health` → `200 OK` (`{"status":"ok"}`).
   - `GET /api/v1/categories` → `200 OK` (3 kategori aktif dari Neon PostgreSQL).
   - `GET /api/v1/events` → `200 OK` (13 event aktif tersaji di katalog produksi).
2. **Swagger UI & OpenAPI Live (Static Assets, 0 CPU Worker):**
   - `GET /api-docs` → `307 Temporary Redirect` ke `/api-docs/`.
   - `GET /api-docs/openapi.yaml` → `200 OK` (`47.081` byte).
   - Pengujian **Try it out** langsung dari browser Chromium pada `/api-docs/`:
     - `GET /health` → `200 OK` (`{"status": "ok"}`).
     - `GET /api/v1/categories` → `200 OK` (data kategori JSON live dari Neon).
3. **SPA Routing & Tata Letak Responsif Live:**
   - Hard refresh langsung pada `/events` (`1440 px` dan `360 px`) serta rute nested `/events/calendar` (`1440 px`) mengembalikan `200 OK` melalui `not_found_handling: "single-page-application"`.
   - Pemeriksaan `document.documentElement.scrollWidth > window.innerWidth` bernilai `false` pada seluruh viewport uji (`360 px` dan `1440 px`).
   - Tidak ada error JavaScript (`pageerror: []`) dan tidak ada request *first-party* yang gagal.

## Bukti Visual Produksi Live

- [Katalog publik live desktop 1440 px](produksi-katalog-desktop-1440.png)
- [Katalog publik live mobile 360 px tanpa overflow](produksi-katalog-mobile-360.png)
- [Kalender event bulanan live (hard refresh `/events/calendar`)](produksi-kalender-desktop-1440.png)
- [Swagger UI Live (`/api-docs/`) dan Try it out `GET /health` 200 OK](produksi-swagger-live-1440.png)

## Batas Verifikasi

Verifikasi live di atas bersifat *read-only* terhadap data produksi agar tidak mencemari database Neon yang sedang digunakan tim. Pengujian skenario tulis penuh (penyelenggara ajukan event → admin setujui → mahasiswa RSVP/batal → ekspor CSV) bersama 3–5 penguji nyata menjadi cakupan sesi simulasi end-to-end & UAT kelompok (koordinasi Dustin & Alexa, menggunakan [PANDUAN_UAT_PENGGUNA_EVENTKU.md](../../../reports/PANDUAN_UAT_PENGGUNA_EVENTKU.md)).
