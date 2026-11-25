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

## QA & DevOps Documentation 
 
### Tools Pendukung & Git Convention 
 
#### 1. Hosting 
 
Opsi hosting yang dipertimbangkan: 
 
- Cloudflare Workers (Static Assets + Workers API)
- Vercel & Render *(opsi awal pada tahap perencanaan UTS)*
 
Hosting digunakan untuk menjalankan aplikasi EventKu pada lingkungan staging maupun production. 
 
**Pilihan:** **Cloudflare Workers** untuk frontend (Workers Static Assets) dan backend API, terhubung ke **Neon PostgreSQL**. *(Pembaruan pasca-UTS: sebelumnya direncanakan Vercel + Render, lalu dikonsolidasikan ke Cloudflare.)*
 
**Alasan:** 
- Cloudflare Workers Static Assets menyajikan hasil build Vite/React SPA secara global dengan dukungan native SPA fallback.
- Frontend dan backend API dapat berjalan pada satu origin yang sama (`/api/v1`), sehingga menghindari hambatan CORS dan membuat tautan poster relatif (`/api/v1/assets/posters/:id`) langsung berfungsi.
- Mendukung deployment otomatis melalui integrasi GitHub (Workers Builds) maupun Cloudflare CLI (`cf`).
- Koneksi ke database **Neon PostgreSQL** dapat dioptimalkan melalui Cloudflare Hyperdrive atau driver serverless Neon.
 
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
