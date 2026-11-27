# EventKu

**Website Kumpulan dan Pendaftaran Event Kampus** — Proyek UAS Mata Kuliah **INF300 Rekayasa Perangkat Lunak**, Kelompok IV, S1 Informatika, Fakultas Teknik UKWMS.

## Tautan Cepat

| Sumber | Tautan |
|---|---|
| **Aplikasi Produksi Live** | https://uas-projek-rpl-eventku.yuhugelo4.workers.dev |
| **Swagger UI Live (OpenAPI 3.0)** | https://uas-projek-rpl-eventku.yuhugelo4.workers.dev/api-docs/ |
| **Dokumentasi Postman (Online)** | [Postman API Documentation](https://alexabixz1212-9078706.postman.co/workspace/Alexa-bix's-Workspace~26e0924a-878a-4e04-894f-0c8fc1ba6f47/documentation/54162513-9b1e6c7e-79b3-4c8b-a207-7c5a89e0f17e) |
| **Spesifikasi OpenAPI & Koleksi Postman** | [`docs/openapi.yaml`](docs/openapi.yaml) · [`EventKu_API_QA_postman_collection.json`](docs/postman/EventKu_API_QA_postman_collection.json) |
| **Dokumentasi Arsitektur & Frontend** | [`DOKUMENTASI_TEKNIS_ARSITEKTUR_FRONTEND.md`](docs/implementation/bambang/week15/DOKUMENTASI_TEKNIS_ARSITEKTUR_FRONTEND.md) |
| **Laporan Akhir & Panduan UAT** | [`EventKu_Laporan_Akhir_Kelompok_IV.pdf`](docs/reports/EventKu_Laporan_Akhir_Kelompok_IV.pdf) · [`PANDUAN_UAT_PENGGUNA_EVENTKU.md`](docs/reports/PANDUAN_UAT_PENGGUNA_EVENTKU.md) |

## Tim Pengembang (Kelompok IV)

| Anggota | NRP | Peran |
|---|---|---|
| Dustin Pranata Wangsawidjaja | 5803024021 | Project Manager & Business Analyst |
| Bambang Herlambang | 5803024019 | System Architect & Frontend Developer |
| Audrey Elizabeth Gracesia | 5803024014 | Backend & UI/UX Developer |
| Alexa Bilxiz Aulia | 5803024023 | QA & DevOps |

## Struktur Repositori

```text
.
├── frontend/          # React 19, Vite 8, Tailwind CSS v4, Vitest, Playwright E2E
├── backend/           # Express 4 Modular Monolith API, PostgreSQL/Neon, Jest + Supertest
├── scripts/           # Build aset statis Swagger UI untuk Cloudflare Workers
├── docs/              # SRS, diagram, OpenAPI, koleksi Postman QA, laporan, catatan mingguan
├── wrangler.jsonc     # Konfigurasi deployment 1 Worker (Static Assets + API + Cron)
└── package.json       # Skrip orkestrasi build & deploy produksi (npm run build / deploy)
```

## Menjalankan Secara Lokal

Prasyarat: **Node.js >= 22.12**.

### 1. Backend API & Swagger UI Lokal

Detail konfigurasi `.env`, migrasi, dan seed database tersedia di [`backend/README.md`](backend/README.md).

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Setelah backend berjalan, buka [Swagger UI Lokal](http://localhost:3000/api-docs/) (atau akses langsung [Swagger UI Live](https://uas-projek-rpl-eventku.yuhugelo4.workers.dev/api-docs/)) untuk menjelajahi dan mencoba endpoint API. Spesifikasi OpenAPI tersedia di [`docs/openapi.yaml`](docs/openapi.yaml), dan koleksi pengujian Postman tersedia di [`docs/postman/`](docs/postman/EventKu_API_QA_postman_collection.json) serta [Dokumentasi Postman Online](https://alexabixz1212-9078706.postman.co/workspace/Alexa-bix's-Workspace~26e0924a-878a-4e04-894f-0c8fc1ba6f47/documentation/54162513-9b1e6c7e-79b3-4c8b-a207-7c5a89e0f17e).

### 2. Frontend SPA

Folder [`frontend`](frontend/README.md) berisi implementasi React, Tailwind CSS, autentikasi, katalog event, pengajuan penyelenggara, RSVP mahasiswa, kalender bulanan WIB, serta dashboard penyelenggara dan admin.

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Arahkan `API_PROXY_TARGET` pada `frontend/.env.local` ke server backend (`http://127.0.0.1:3000`) untuk menjalankan alur dengan data nyata, atau jalankan `npm run dev:demo` di folder `frontend` untuk mencoba alur UI menggunakan data dummy.

### 3. Pengujian Otomatis

```powershell
cd backend; npm test                        # 64 tes Jest (unit, keamanan, kontrak, UAT API, Swagger)
cd frontend; npm test                       # 73 tes unit Vitest
cd frontend; npx playwright test --workers=2 # 36 tes regresi browser Chromium
```

## Implementasi & Bukti Mingguan (Frontend & Arsitektur)

- [Minggu 9–11 — Autentikasi & Guard Rute](docs/implementation/bambang/week9-11/README.md)
- [Minggu 12 — Katalog, Pengajuan Event, & RSVP](docs/implementation/bambang/week12/README.md)
- [Minggu 13 — Kalender Bulanan WIB & Regresi RSVP](docs/implementation/bambang/week13/README.md)
- [Minggu 14 — Perbaikan UI Responsif & Pemulihan RSVP](docs/implementation/bambang/week14/README.md)
- [Minggu 15 — Build Produksi, Cloudflare Workers, & Dokumentasi Teknis](docs/implementation/bambang/week15/README.md) ([Laporan Verifikasi & Bukti Live](docs/implementation/bambang/week15/evidence/verification.md))

## QA & DevOps Documentation

### 1. Hosting & Deployment Produksi

Opsi hosting yang dipertimbangkan:

- **Cloudflare Workers** (Workers Static Assets + Workers API)
- Vercel & Render *(opsi awal pada tahap perencanaan UTS)*

**Pilihan:** **Cloudflare Workers** (`uas-projek-rpl-eventku`) untuk menyajikan frontend SPA, Swagger UI, dan backend API dalam satu Worker terpadu yang terhubung ke **Neon PostgreSQL**. *(Pembaruan pasca-UTS: sebelumnya direncanakan Vercel + Render, lalu dikonsolidasikan ke Cloudflare.)*

- **URL Produksi Live:** https://uas-projek-rpl-eventku.yuhugelo4.workers.dev
- **Swagger UI Live:** https://uas-projek-rpl-eventku.yuhugelo4.workers.dev/api-docs/
- **Database:** **Neon PostgreSQL** melalui `@neondatabase/serverless` (`poolQueryViaFetch: true` untuk query tunggal + WebSocket interaktif untuk transaksi RSVP atomik).
- **Konfigurasi:** [`wrangler.jsonc`](wrangler.jsonc) menyajikan hasil build Vite (`frontend/dist`) dan aset statis Swagger UI ([`scripts/build-swagger-assets.mjs`](scripts/build-swagger-assets.mjs)) dengan native SPA fallback (`not_found_handling: "single-page-application"`), meneruskan `/api/*` & `/health` ke Express Worker (`backend/src/worker.js` via `cloudflare:node` `httpServerHandler`), mengaktifkan Smart Placement, dan menjadwalkan Cron Trigger tiap 5 menit (`*/5 * * * *`).
- **Build & Deploy dari root repositori** *(dengan secrets `DATABASE_URL` dan `JWT_SECRET` di Cloudflare Workers)*:

```powershell
npm run build
npx wrangler deploy
```

### 2. Testing Tools

Tools pengujian yang digunakan pada proyek EventKu:

- **Postman:** menguji endpoint API secara manual, mendokumentasikan kontrak request/response, serta menyimpan koleksi QA ([`docs/postman/`](docs/postman/EventKu_API_QA_postman_collection.json)).
- **Jest & Supertest:** unit test, security test, kontrak API, 61 skenario UAT API + 17 retest defect, dan pengukuran *code coverage* backend.
- **Vitest:** unit test layanan, utilitas WIB/kalender, dan state autentikasi frontend.
- **Playwright (Chromium):** pengujian regresi UI responsif (320/360/1440 px), demo E2E multi-peran, serta verifikasi integrasi dan situs produksi live.

### 3. Git Commit Convention

Tim menggunakan format commit berikut:

| Prefix | Penggunaan | Contoh |
|---|---|---|
| `feat` | Menambahkan fitur | `feat: menambahkan fitur login` |
| `fix` | Memperbaiki bug | `fix: memperbaiki validasi login` |
| `test` | Menambahkan/perbaiki testing | `test: menambahkan test API login` |
| `docs` | Perubahan dokumentasi | `docs: memperbarui README` |
| `refactor` | Perubahan struktur kode | `refactor: merapikan service auth` |

Contoh:

```bash
git commit -m "feat: menambahkan fitur login"
git commit -m "test: menambahkan unit test authentication"
git commit -m "fix: memperbaiki validasi password"
```
