# Frontend EventKu

Implementasi bagian Bambang untuk Minggu 9–14 mencakup setup React dan Tailwind, Auth, katalog event, pengajuan penyelenggara, RSVP mahasiswa, kalender bulanan, dan perbaikan hasil uji frontend. Desain mengacu pada gambar Figma di laporan UTS. Struktur memisahkan halaman, komponen, layanan HTTP, state sesi, hooks, dan route guard.

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

## Demo lokal dengan data dummy

Dari folder `frontend`, jalankan `npm ci` untuk instalasi pertama, lalu `npm run dev:demo`. Buka [katalog demo](http://127.0.0.1:5174/events). Mode demo memakai API lokal pada proses Vite dan tidak memerlukan konfigurasi `.env.local`.

| Akun dummy | Email | Kata sandi |
|---|---|---|
| Mahasiswa UKWMS terverifikasi | `mahasiswa@demo.test` | `EventKuDemo123!` |
| Akun uji tanpa verifikasi UKWMS | `mahasiswa.luar@demo.test` | `EventKuDemo123!` |
| Penyelenggara terverifikasi | `penyelenggara@demo.test` | `EventKuDemo123!` |
| Penyelenggara menunggu verifikasi | `penyelenggara.baru@demo.test` | `EventKuDemo123!` |
| Admin | `admin@demo.test` | `EventKuDemo123!` |

Dari detail event, mahasiswa dapat mendaftar dan membuka daftar RSVP untuk membatalkannya. Penyelenggara dapat memilih **Ajukan event**, **Event organisasi** untuk melihat status dan daftar peserta aktif atau mengunduh CSV, serta **Notifikasi** untuk membaca hasil moderasi. Untuk mencoba registrasi penyelenggara, gunakan ID `demo-organisasi-baru` selama organisasinya masih menunggu verifikasi.

Akun admin bisa membuka **Buka antrean moderasi**, **Verifikasi organisasi**, dan **Kelola kategori** dari halaman akun. Demo menyediakan dua pengajuan awal. Untuk mencoba alur verifikasi, verifikasi **Komunitas Mahasiswa Baru**, lalu pilih **Periksa status verifikasi** di halaman akun penyelenggara baru. Perubahan demo tersimpan selama server Vite berjalan.

Moderasi memakai `GET /api/v1/admin/events/moderation?page=1&limit=10` (respons `{ data, total, page }`) dan `PATCH /api/v1/admin/events/moderation/:eventId` (body `{ status, reason? }`, respons `{ eventId, status }`). Nilai status keputusan adalah `disetujui` atau `ditolak`. Penolakan wajib menyertakan alasan hingga 500 karakter. Endpoint ini tersedia di demo lokal dan perlu diselaraskan dengan API backend tim saat integrasi.

| Fitur | Endpoint demo dengan awalan `/api/v1` |
|---|---|
| Verifikasi organisasi | `GET /admin/organizations`, `PATCH /admin/organizations/:id` dengan `{ status }` (`verified` atau `suspended`). |
| Kategori | `GET /admin/categories`, `POST /admin/categories` dengan `{ name }`, dan `PATCH /admin/categories/:id` dengan `{ name, isActive }`. Kategori nonaktif hilang dari pilihan form dan filter. Event yang sudah terbit tetap dapat dibuka. |
| Notifikasi moderasi | `GET /notifications/me`, `PATCH /notifications/me/:id/read`. Keputusan tersedia bagi penyelenggara di organisasi pemilik event. |
| Event dan peserta | `GET /organizer/events`, `GET /organizer/events/:id/participants` dengan judul event dan daftar peserta aktif. Tambahkan `?format=csv` untuk mengunduh semua peserta aktif sebagai respons JSON `{ csv }`. Akses peserta dan ekspor memerlukan organisasi pemilik yang terverifikasi. |

Daftar di atas menggunakan `page` dan `limit` dengan respons `{ data, total, page }`. Untuk demo ekspor, lakukan RSVP dengan akun mahasiswa pada event internal, kemudian buka daftar peserta event yang sama dengan akun penyelenggara terverifikasi.

### Fitur lanjutan dan verifikasi

| Akses | Cara mencoba di demo |
|---|---|
| Semua akun | **Pengaturan akun** untuk mengubah nama, URL foto HTTPS, dan kata sandi. Dari halaman masuk, **Lupa kata sandi?** menampilkan tautan pemulihan demo setelah email dimasukkan. |
| Mahasiswa | **Atur minat**, lalu setujui event dengan kategori yang diminati dari akun admin. **Notifikasi mahasiswa** memuat event baru, konfirmasi RSVP, pengingat 24 jam sebelum mulai, serta perubahan atau pembatalan. Aktifkan preferensi email untuk melihat salinannya di **Kotak email demo**. |
| Mahasiswa | Simpan event dari detail, lalu buka **Event favorit**. Buka **Pendaftaran saya → Riwayat → Lokakarya Orientasi (Demo)** untuk memberi rating dan ulasan pada event selesai yang sudah diikuti. Kalender bisa difilter menurut kategori dan menandai event yang sudah didaftari. |
| Penyelenggara | Di **Event organisasi → Kelola event**, edit, ajukan draft, atau batalkan event. Perubahan jadwal atau lokasi event tayang memicu moderasi ulang dan notifikasi peserta. Form menerima poster JPG, PNG, atau WebP hingga 2 MB, serta URL HTTPS. **Statistik organisasi** menampilkan peserta aktif, kuota terisi, dan tren pendaftaran. |
| Admin | **Kelola pengguna** untuk menonaktifkan atau mengaktifkan kembali akun nonadmin. Di **Moderasi event**, buka **Event tayang** untuk menurunkan event dengan alasan atau **Riwayat moderasi** untuk melihat keputusan dan pelakunya. **Statistik platform** menampilkan jumlah pengguna, event, pendaftaran aktif, serta distribusi event. |

Endpoint tambahan memakai awalan `/api/v1`. Alur ini memerlukan kontrak yang sama di backend tim untuk penggunaan di luar mode demo.

| Alur | Kontrak tambahan |
|---|---|
| Profil dan kata sandi | `PATCH /auth/me/profile` dengan `{ name, photoUrl }`; `PATCH /auth/me/password` dengan `{ currentPassword, password }`; `POST /auth/forgot-password` dengan `{ email }`; `POST /auth/reset-password` dengan `{ token, password }`. `demoResetPath` hanya digunakan oleh mode demo. |
| Poster | `POST /assets/posters` dengan `{ type, data }`, yaitu MIME dan isi Base64. Respons `{ posterUrl }` yang bisa dipakai pada pengajuan dan penyuntingan event. |
| Kelola event | `GET /organizer/events/:eventId` → `{ event }`. `PATCH` memakai `{ action, expectedStatus, expectedVersion, event? }` dengan aksi `update` atau `cancel`. |
| Aktivitas mahasiswa | `GET /student/notifications`, `PATCH /student/notifications/:id/read`, `GET/PUT /student/interests` dengan `{ categoryIds }`, dan `GET/PUT /student/notification-preferences` dengan `{ emailEnabled }`. `GET /student/demo-mail` khusus simulasi email lokal. |
| Favorit dan ulasan | `GET /student/favorites`, `GET/PUT/DELETE /student/favorites/:eventId` → `{ saved }`, dan `GET/PUT /student/reviews/:eventId` dengan `{ rating, comment }` untuk menyimpan. |
| Moderasi lanjutan | `GET /admin/events/moderation?scope=published` atau `scope=history`. Gunakan `PATCH` pada event tayang dengan `{ status: "dibatalkan", reason }` untuk menurunkannya. |
| Pengguna dan statistik | `GET /admin/users`, `PATCH /admin/users/:id` dengan `{ status }`, `GET /admin/statistics`, dan `GET /organizer/statistics`. |

Demo menjalankan transisi event selesai dan pengingat H-1 secara lokal. Pengiriman email nyata, penyimpanan persisten, penjadwalan production, dan validasi integrasi tetap bergantung pada backend tim.

```powershell
npm test
npm run test:e2e -- --workers=2
npx playwright test -c playwright.demo.config.js
npm run build
```

Contoh pendaftaran eksternal tersedia di **Kompetisi Inovasi Pelajar (Demo)**. Pengunjung dapat membaca syarat peserta dan membuka tautan contoh panitia tanpa masuk. Untuk mengajukan event serupa, pilih **Daftar lewat tautan panitia**, isi target peserta, dan masukkan URL HTTPS.

Seluruh RSVP internal, termasuk **Seminar Karier Teknologi**, memerlukan akun mahasiswa UKWMS terverifikasi. Akun uji tanpa verifikasi bisa membuka katalog dan tautan panitia. Akun mahasiswa baru menunggu verifikasi UKWMS sebelum dapat melakukan RSVP.

Integrasi backend untuk pendaftaran eksternal memerlukan dukungan `registrationMode: "external"`, `audience`, dan `registrationUrl` pada pengajuan dan respons detail. Kuota ditangani panitia untuk mode tersebut. Field `audience` opsional pada RSVP internal.

Backend harus mengembalikan boolean `ukwmsVerified: true` di `/auth/me` hanya setelah identitas mahasiswa UKWMS terverifikasi. Endpoint RSVP perlu menegakkan syarat ini pada setiap event internal dan mengembalikan 403 jika syarat belum terpenuhi. Demo mensimulasikan status itu pada akun contoh dan menerapkan pemeriksaan tersebut di API lokal.

Gunakan kredensial dummy saja. Data akun, draft, dan RSVP tersimpan dalam memori server demo hingga proses dihentikan. Mode ini hanya aktif pada server pengembangan. Untuk memakai API tim, jalankan `npm run dev` dengan konfigurasi backend di atas.

## Cakupan

| Minggu | Hasil |
|---|---|
| 9 | Vite, React, Tailwind, routing, komponen dasar, konfigurasi environment dan lockfile |
| 10 | Login/register responsif, validasi, status loading/error, password visibility, pilihan mahasiswa/penyelenggara |
| 11 | Client register/login/me, Bearer token, AuthContext, pemulihan sesi, logout lokal dan guard navigasi berdasarkan profil API |
| 12 | Katalog dan detail publik, pencarian/filter/paginasi, pengajuan event oleh penyelenggara terverifikasi, serta RSVP, pembatalan, dan riwayat mahasiswa |
| 13 | Kalender bulanan publik, navigasi bulan/hari ini, agenda per tanggal WIB, pemulihan pilihan lewat URL, serta perbaikan deteksi RSVP pada halaman kedua dan seterusnya |
| 14 | Pemulihan status RSVP setelah kegagalan API, akses Daftar langsung dari navigasi ponsel, dan tata letak tombol pengajuan responsif. Lihat [catatan dan bukti uji](../docs/implementation/bambang/week14/README.md). |

## Kalender bulanan

Buka `/events/calendar` dari navigasi **Kalender** atau tombol di katalog. Pilih bulan, tombol bulan sebelumnya/berikutnya, atau **Hari ini**. Klik tanggal untuk melihat agenda hari tersebut; **Tampilkan semua tanggal** mengembalikan agenda bulanan. Tautan judul membuka detail event, dan **Kembali ke kalender** mempertahankan bulan/tanggal yang dipilih. Contoh URL: `/events/calendar?month=2026-11&date=2026-11-14`.

Kalender memakai hari mulai event dalam WIB, termasuk event yang dimulai pada hari sebelumnya menurut UTC. Event beberapa hari ditampilkan pada tanggal mulai; rentang lengkapnya tersedia di detail. Semua halaman `GET /events?from=&to=&page=&limit=20` dimuat sebelum kalender ditampilkan. `from` adalah awal bulan WIB inklusif dan `to` awal bulan berikutnya eksklusif, sesuai kontrak pencarian yang sudah ada. Tidak diperlukan endpoint kalender atau dependensi tambahan. Loading, error API, coba lagi, dan bulan/tanggal tanpa event memiliki tampilan tersendiri.

Di ponsel, sel kalender menampilkan tanggal dan jumlah event; judul lengkap tersedia pada agenda di bawah kalender. Dokumentasi dan hasil verifikasi: [Minggu 13](../docs/implementation/bambang/week13/README.md).

Tes browser menjalankan alur melalui fixture kontrak. Integrasi dengan backend Audrey menunggu server Auth dan Event yang dapat diuji. Catatan konfigurasi, endpoint, dan hasil pengujian ada di [Minggu 9–11](../docs/implementation/bambang/week9-11/README.md) dan [Minggu 12](../docs/implementation/bambang/week12/README.md).

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

Hasil pengujian awal Auth tercatat pada [bukti Minggu 9–11](../docs/implementation/bambang/week9-11/evidence/verification.md). Hasil terbaru untuk Auth dan Event ada di [Minggu 12](../docs/implementation/bambang/week12/README.md).

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
