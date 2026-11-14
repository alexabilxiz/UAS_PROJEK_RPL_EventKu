PROJEK NAME "EVENTKU"

# EventKu 
 
Website Kumpulan dan Pendaftaran Event Kampus 
 
## Implementasi frontend Bambang, Minggu 9–13

Folder [`frontend`](frontend/README.md) berisi React, Tailwind, autentikasi, katalog event, pengajuan penyelenggara, RSVP mahasiswa, dan kalender event bulanan.

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Gunakan Node.js minimal 22.12. Arahkan `API_PROXY_TARGET` pada `.env.local` ke server Auth dan Event untuk menjalankan alur dengan data nyata. Pengujian otomatis menggunakan fixture kontrak API.

Catatan implementasi dan pengujian tersedia untuk [Minggu 9–11](docs/implementation/bambang/week9-11/README.md), [Minggu 12](docs/implementation/bambang/week12/README.md), dan [Minggu 13](docs/implementation/bambang/week13/README.md). Kalender publik tersedia di `/events/calendar`; untuk mencoba dengan data dummy jalankan `npm run dev:demo` dari folder `frontend`.

## QA & DevOps Documentation 
 
### Tools Pendukung & Git Convention 
 
#### 1. Hosting 
 
Opsi hosting yang dipertimbangkan: 
 
- Vercel 
- Render 
 
Hosting digunakan untuk menjalankan aplikasi EventKu pada lingkungan staging maupun production. 
 
**Pilihan:** Vercel untuk frontend dan Render untuk backend. 
 
**Alasan:** 
- Vercel memiliki konfigurasi yang sederhana untuk deployment frontend. 
- Vercel mendukung deployment aplikasi melalui repository Git. 
- Render dapat digunakan untuk menjalankan backend Node.js dan Express.js. 
- Vercel dan Render dapat digunakan untuk deployment aplikasi dari tahap development hingga production. 
 
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
