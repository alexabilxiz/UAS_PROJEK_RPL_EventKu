# Frontend EventKu

Implementasi bagian Bambang untuk Minggu 9–11: setup React dan Tailwind, UI login/register, serta client integrasi API Auth. Desain mengacu gambar Figma pada laporan UTS. Struktur memisahkan halaman, komponen, layanan HTTP, state sesi, hooks, dan route guard.

## Menjalankan

Prasyarat: Node.js minimal 22.12 dan npm. Pengujian lokal dilakukan dengan Node 22.16.0. Jalankan perintah dari folder `frontend`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Buka alamat yang dicetak Vite, biasanya `http://localhost:5173`. Halaman login/register dapat dilihat tanpa backend. Login dan registrasi hanya dinyatakan berhasil bila API mengembalikan respons yang valid; tidak ada akun demo atau login palsu bawaan.

`API_PROXY_TARGET` di `.env.local` menunjuk server Audrey, misalnya `http://127.0.0.1:3000`. Vite meneruskan `/api/v1/*` ke server tersebut. Ubah target sesuai alamat yang benar dan mulai ulang Vite. Jangan memasukkan password database, API secret, atau JWT secret ke variabel `VITE_*` karena isinya masuk bundle browser.

Untuk API HTTPS pada host terpisah, atur `VITE_API_BASE_URL=https://HOST-BACKEND/api/v1` dan aktifkan CORS untuk origin frontend pada backend. Host contoh itu harus diganti alamat nyata. Proxy Vite hanya untuk development; hosting produksi harus menyiapkan reverse proxy `/api/v1` atau menggunakan URL HTTPS API yang benar.

## Cakupan

| Minggu | Hasil |
|---|---|
| 9 | Vite, React, Tailwind, routing, komponen dasar, konfigurasi environment dan lockfile |
| 10 | Login/register responsif, validasi, status loading/error, password visibility, pilihan mahasiswa/penyelenggara |
| 11 | Client register/login/me, Bearer token, AuthContext, pemulihan sesi, logout lokal dan guard navigasi berdasarkan profil API |

Integrasi kode frontend diuji dengan fixture kontrak. Uji end-to-end terhadap backend Audrey belum dapat dilakukan karena implementasi/URL backend belum tersedia dalam repository. Lihat `../docs/implementation/bambang/week9-11/README.md` untuk rincian dan daftar pengecekan integrasi nyata.

Listing/filter event, pengajuan, RSVP dan kalender interaktif berada pada Minggu 12–13 dan belum diimplementasikan di sini. Beranda akun hanya menampilkan data profil yang benar-benar dikembalikan API. Tidak ada statistik/kegiatan/peserta fiktif.

## Kontrak Auth

Base URL default `/api/v1`, request dan response JSON.

| Endpoint | Request | Response |
|---|---|---|
| `POST /auth/register` | `{name,email,password,role,organizationId?}` | `201 {userId,role,status,organizationId}` |
| `POST /auth/login` | `{email,password}` | `200 {accessToken,user}` |
| `GET /auth/me` | `Authorization: Bearer <token>` | `200 {userId,role,status,organization}` |

`login.user` minimal berisi `userId` dan `role`; profil `/me` menjadi acuan pengguna/peran sebelum akses diberikan. `name` dan `email` ditampilkan jika tersedia. `organization` dapat berupa `{organizationId,status}`; normalisasi juga menerima `organizationId` dan `organizationStatus` pada root. ID diperlakukan sebagai string opaque karena pilihan UUID/BIGINT belum ditetapkan tim.

Role publik hanya `mahasiswa` dan `penyelenggara`. Admin dibuat internal dan tetap dapat login. Sesuai kontrak Minggu 6, penyelenggara mengisi ID organisasi dari pengelola. Belum ada endpoint daftar organisasi publik, sehingga UI tidak menebak daftar organisasi dan tidak memakai endpoint khusus admin. Backend tetap harus memeriksa ID dan status verifikasi.

Password registrasi minimal 8 karakter sesuai SRS. Tidak ada aturan domain email/NIM/huruf-angka tambahan yang dipaksakan karena belum ditentukan kontrak API. Konfirmasi password hanya digunakan pada form dan tidak dikirim. Registrasi berhasil diarahkan ke login, bukan langsung dianggap sudah terautentikasi.

Error 401, 403, 409, 422, 429, 5xx, koneksi, timeout, dan respons malformed ditangani. Pesan server mentah/HTML tidak ditampilkan. Field error opsional menerima objek `fieldErrors` atau `errors` dengan key `name`, `email`, `password`, `role`, `organizationId`; bentuk error final perlu disepakati dengan Audrey.

## Sesi dan batas keamanan

- Token disimpan di `sessionStorage` secara default; opsi Ingat saya menggunakan `localStorage`. Password tidak disimpan.
- Setiap pemulihan sesi memakai `/auth/me`. Sesi tidak dipercaya hanya berdasarkan role lokal atau hasil decode JWT.
- 401 menghapus sesi; gangguan jaringan atau 403 tidak menghapus token, tetapi tidak memberi akses halaman terlindungi sebelum profil terverifikasi.
- Logout menghapus kedua penyimpanan dan state. Kontrak saat ini belum memiliki endpoint revoke/logout server atau refresh token. JWT lama mungkin tetap valid sampai kedaluwarsa; backend perlu menetapkan masa berlaku dan strategi pencabutan.
- Sesi Ingat saya mengikuti pergantian token/logout pada tab lain tanpa penghapusan berantai; token pengganti diverifikasi ulang lewat `/auth/me`. Sesi sementara pada `sessionStorage` tetap terisolasi per tab.
- Web storage tetap dapat dibaca skrip pada origin yang sama. Cookie HttpOnly membutuhkan perubahan kontrak backend; kebijakan itu belum diubah sepihak.
- Route guard membantu navigasi. Semua otorisasi, verifikasi organisasi, hash password, validasi unik email, rate limit, dan kepemilikan tetap tanggung jawab backend.
- Lupa kata sandi membuka keterangan bantuan; pemulihan lewat email merupakan Should dan belum diklaim berfungsi.

## Pengujian

```powershell
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Vitest menguji transport HTTP, kontrak Auth dan transisi sesi. Playwright menjalankan UI Chromium, mengintersepsi request pada batas API untuk memeriksa payload, Bearer header, login/register, role guard, refresh/logout, error dan lebar 360 px. Fixture hanya berlaku pada proses tes; tidak disertakan sebagai backend produksi.

Hasil tes tidak membuktikan API/database Audrey tersedia atau lolos QA. Workbook test case Alexa dan analisis individu anggota tidak diubah. `dist`, `node_modules`, laporan tes, dan `.env.local` diabaikan Git.

Verifikasi 3 November 2026: build produksi berhasil, 57 tes unit lulus, dan 16 tes browser Chromium lulus. Screenshot desktop/ponsel dan log perintah ada pada [bukti pengujian](../docs/implementation/bambang/week9-11/evidence/verification.md).

## Struktur

```text
src/
  components/  # FormField, PasswordField, Brand, AuthLayout, PageShell
  context/     # AuthContext dan penyimpanan sesi
  hooks/       # useAuth
  pages/       # beranda, login, register, akun dan bantuan
  routes/      # RoleRoute
  services/    # apiClient dan authService
  utils/       # validasi form dan redirect internal
e2e/           # tes browser dengan fixture API
```

Foto `public/campus.jpg` diambil dari area foto pada gambar Figma Login dalam `docs/reports/figures/figma/login.png`; gambar sumber dan desain asli tidak diubah.

Konfigurasi mengikuti dokumentasi resmi [React](https://react.dev/learn/build-a-react-app-from-scratch), [Vite](https://vite.dev/guide/), dan [Tailwind untuk Vite](https://tailwindcss.com/docs/installation/using-vite).
