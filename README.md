PROJEK NAME "EVENTKU"

# EventKu 
 
Website Kumpulan dan Pendaftaran Event Kampus 
 
## Implementasi frontend Bambang, Minggu 9–14

Folder [`frontend`](frontend/README.md) berisi React, Tailwind, autentikasi, katalog event, pengajuan penyelenggara, RSVP mahasiswa, dan kalender event bulanan.

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Gunakan Node.js minimal 22.12. Arahkan `API_PROXY_TARGET` pada `.env.local` ke server Auth dan Event untuk menjalankan alur dengan data nyata. Pengujian otomatis menggunakan fixture kontrak API.

Catatan implementasi dan pengujian tersedia untuk [Minggu 9–11](docs/implementation/bambang/week9-11/README.md), [Minggu 12](docs/implementation/bambang/week12/README.md), [Minggu 13](docs/implementation/bambang/week13/README.md), [Minggu 14](docs/implementation/bambang/week14/README.md), dan [Minggu 15](docs/implementation/bambang/week15/README.md). Jalankan `npm run dev:demo` dari folder `frontend` untuk mencoba alur dengan data dummy.

## Backend API & Swagger

Jalankan backend lokal:

```powershell
cd backend
npm ci
npm run dev
```

Setelah backend berjalan, buka [Swagger UI](http://localhost:3000/api-docs/) untuk menjelajahi dan mencoba endpoint API. Spesifikasi OpenAPI tersedia di [`docs/openapi.yaml`](docs/openapi.yaml).

## QA & DevOps Documentation 
 
### Tools Pendukung & Git Convention 
 
#### 1. Hosting 
 
Opsi hosting yang dipertimbangkan: 
 
- Cloudflare Workers (Static Assets + Workers API)
- Vercel & Render *(opsi awal pada tahap perencanaan UTS)*
 
Hosting digunakan untuk menjalankan aplikasi EventKu pada lingkungan staging maupun production. 
 
**Pilihan:** **Cloudflare Workers** untuk frontend (Workers Static Assets) dan backend API dalam satu Worker (`uas-projek-rpl-eventku`), terhubung ke **Neon PostgreSQL**. *(Pembaruan pasca-UTS: sebelumnya direncanakan Vercel + Render, lalu dikonsolidasikan ke Cloudflare.)*

**URL Produksi Live:** https://uas-projek-rpl-eventku.yuhugelo4.workers.dev

**Alasan & Implementasi:** 
- Cloudflare Workers Static Assets menyajikan hasil build Vite/React SPA (`frontend/dist`) secara global dengan dukungan native SPA fallback (`not_found_handling: "single-page-application"`).
- Frontend dan backend API Express (`backend/src/worker.js` via `cloudflare:node` `httpServerHandler`) berjalan pada satu origin yang sama (`run_worker_first: ["/api/*", "/health"]`), sehingga menghindari hambatan CORS dan membuat tautan poster relatif (`/api/v1/assets/posters/:id`) langsung berfungsi.
- Koneksi ke **Neon PostgreSQL** memakai `@neondatabase/serverless` (`poolQueryViaFetch: true` untuk query tunggal + WebSocket interaktif untuk transaksi RSVP) serta Smart Placement dan Cron Trigger (`*/5 * * * *`) pada [`wrangler.jsonc`](wrangler.jsonc).
- Build & deploy dari root repositori: `npm run build` lalu `npx wrangler deploy` (dengan secrets `DATABASE_URL` dan `JWT_SECRET` di Cloudflare Workers).
 
**Database:** Neon PostgreSQL digunakan sebagai database aplikasi EventKu. 
 
#### 2. Testing Tools 
 
Tools yang digunakan: 
 
- Postman 
- Jest 
 
**Postman** digunakan untuk menguji endpoint API secara manual, termasuk request dan response dari backend. 
 
**Jest** digunakan untuk membuat dan menjalankan unit test pada kode aplikasi, khususnya pada fungsi-fungsi backend. 
 
#### 3. Git Commit Convention 
 
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
