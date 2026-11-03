# Implementasi Bambang Minggu 9 sampai 11

Nama: Bambang Herlambang — 5803024019

Peran: System Architect dan Frontend Developer

Tanggal pengerjaan: 3 November 2026

## Acuan

- Rincian Pekerjaan Individu Mingguan Proyek EventKu, halaman 10–12.
- `docs/requirements/EventKu_2_SRS.docx`, FR-AUTH-01 sampai FR-AUTH-05 dan NFR responsivitas/keamanan.
- `docs/architecture/minggu6_arsitektur_modular_classdiagram_erd.docx`, kontrak Auth `/api/v1`.
- `docs/architecture/minggu7_design_pattern_struktur_frontend.docx`, pemisahan service, context, hook dan route guard.
- Sembilan gambar Figma asli pada `docs/reports/figures/figma`; implementasi fase ini berfokus pada Login dan Register.

## Hasil per minggu

| Minggu | Tugas Bambang | Realisasi | Verifikasi dan batas |
|---|---|---|---|
| 9 | Inisialisasi React, Tailwind, struktur komponen | Project `frontend` dengan Vite, React Router, Tailwind, komponen reusable dan `.env.example` | Build produksi dan development server berhasil dijalankan |
| 10 | UI login/register sesuai kontrak API | Tampilan desktop/ponsel, validasi email/password, konfirmasi, pilihan role, organisasi penyelenggara, loading/error, tombol password | Tes browser dengan input valid/invalid, error, navigasi dan lebar 360 px |
| 11 | Mengintegrasikan Auth dengan API Audrey | Client register/login/me, Bearer token, profil API sebagai acuan role, persistence pilihan pengguna, logout dan route guard | Integrasi frontend terhadap fixture kontrak tersedia; integrasi backend nyata masih menunggu API Audrey |

Repository lokal dan remote yang diperiksa belum berisi implementasi backend atau host API. Frontend tidak membuat akun berhasil secara otomatis ketika server tidak tersedia. Tanggal ini adalah tanggal implementasi lokal, bukan klaim pekerjaan telah dikerjakan pada minggu kalender sebelumnya.

Pemeriksaan ulang repository yang diberikan pengguna, https://github.com/alexabilxiz/UAS_PROJEK_RPL_EventKu, dilakukan pada 3 November 2026 dengan `git fetch origin --prune` dan inspeksi tree semua branch remote yang tersedia:

| Branch | Commit saat diperiksa | Isi yang relevan |
|---|---|---|
| `main` | `c151b2ff071bfd7c06628c5e5337bb65003ee52f` | README dan dokumen; tidak ada kode backend Auth |
| `develop` | `c1cf4d1d7b2ac918ceea0035aec6524f4abf4f4f` | README; tidak ada kode backend Auth |
| `feature/qa-testing` | `3a729997472d7531a2cd234968819bc1a548326a` | README; tidak ada kode backend Auth |

Minggu 11 belum dinyatakan selesai end-to-end. Yang tersedia adalah implementasi client dan tes kontrak frontend, siap dihubungkan ketika backend Audrey diberikan.

## Keputusan implementasi

1. Context API digunakan untuk sesi Auth sederhana, sesuai rancangan Minggu 7. Seluruh HTTP dipusatkan pada `services`.
2. Registrasi publik hanya mahasiswa/penyelenggara; admin internal. Email unik diverifikasi backend. Password minimal 8 karakter mengikuti SRS.
3. Field NIM pada Figma awal tidak dikirim karena kontrak API Auth tidak memuat NIM. Field peran dan ID organisasi dilengkapi sesuai SRS/kontrak.
4. ID organisasi diketik dari data yang diberikan pengelola. Tidak ada daftar organisasi fiktif atau akses lookup khusus admin dari halaman publik.
5. Token sementara berada pada sessionStorage; Ingat saya memakai localStorage. Profil dipulihkan lewat `/auth/me`, tidak berdasarkan JWT yang dipercaya sepihak di UI. Penggantian token remembered tidak menghapus sesi tab lain secara berantai; logout remembered diteruskan ke tab lain, sedangkan sesi sementara tetap terisolasi per tab.
6. Role guard memeriksa navigasi mahasiswa, penyelenggara, dan admin. Backend tetap menjadi otoritas akses.
7. Halaman akun hanya shell untuk memverifikasi sesi dan role. Fitur Minggu 12–13 belum dikerjakan.

## Uji backend nyata yang masih diperlukan

Saat API Audrey tersedia, atur environment sesuai `frontend/README.md`, kemudian jalankan:

- Registrasi mahasiswa baru mengembalikan 201; email duplikat 409 dan input invalid 422.
- Registrasi penyelenggara menerima organizationId yang sah dan menunggu verifikasi organisasi; admin tidak tersedia pada signup publik.
- Login valid mengembalikan `{accessToken,user}`; login salah 401 dan batas percobaan 429 bila diterapkan.
- `/auth/me` menerima Bearer dan mengembalikan identitas/peran yang benar; reload mempertahankan sesi, token kedaluwarsa menghasilkan 401.
- Logout lokal menghapus sesi. Tetapkan kebijakan expiry/revoke server bersama backend.
- Akun mahasiswa tidak dapat mengakses endpoint admin/penyelenggara meskipun request dibuat di luar UI.
- CORS, HTTPS, format field error, pemetaan status akun/organisasi, dan tipe ID final cocok dengan frontend.

Daftar ini belum ditandai lulus karena belum diuji terhadap backend Audrey. Pengerjaan frontend ini tidak mengubah Jira atau bukti individu anggota lain. Status publikasi kode mengikuti riwayat Git repository.

## Bukti frontend

| Bukti | File |
|---|---|
| Login desktop, 1440 × 1000 | [login-desktop.png](evidence/login-desktop.png) |
| Register desktop, 1440 × 1000 | [register-desktop.png](evidence/register-desktop.png) |
| Login mobile, lebar 360 px | [login-mobile.png](evidence/login-mobile.png) |
| Register mobile, lebar 360 px | [register-mobile.png](evidence/register-mobile.png) |
| Hasil perintah dan batas verifikasi | [verification.md](evidence/verification.md) |

Screenshot diambil dari frontend lokal melalui browser Chromium. Gambar sumber Figma tetap berada di folder laporan. Tes frontend dengan fixture bukan pengganti hasil QA API/database. Workbook QA Alexa tetap mengikuti data pemiliknya.
