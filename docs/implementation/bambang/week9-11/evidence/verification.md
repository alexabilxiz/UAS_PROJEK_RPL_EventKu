# Verifikasi frontend Bambang, Minggu 9–11

Tanggal: 3 November 2026. Pengujian dijalankan lokal pada Windows, Node.js 22.16.0, npm 11.6.2, Chromium melalui Playwright 1.64.1. Hasil ini mencatat pengujian lokal; status publikasi kode mengikuti riwayat Git repository.

## Hasil aktual

| Perintah dari folder `frontend` | Hasil | Log |
|---|---|---|
| `npm run build` | Lulus; bundle produksi dibuat | [build.log](build.log) |
| `npm test` | 57 tes lulus, 3 file | [unit-tests.log](unit-tests.log) |
| `npm run test:e2e -- --workers=3` | 16 tes Chromium lulus | [browser-tests.log](browser-tests.log) |
| `npm audit --omit=dev --audit-level=moderate` | 0 kerentanan pada dependensi produksi yang diperiksa | Output CLI: `found 0 vulnerabilities` |

Pada perintah browser, npm mengabaikan opsi workers dan Playwright menjalankan 8 worker. Seluruh 16 tes tetap lulus. Untuk menjalankan ulang cukup gunakan `npm run test:e2e`; konfigurasi membatasi worker pada CI.

## Cakupan yang terbukti

- Transport HTTP: JSON, Bearer token, konfigurasi URL, pembatalan, timeout, status error dan respons yang tidak sesuai kontrak.
- Kontrak login, register dan profil: payload sesuai, role publik terbatas, organisasi wajib untuk penyelenggara, ID diperlakukan sebagai identitas opaque.
- Sesi: `/auth/me` sebagai acuan peran, pemulihan sesi, 401, gangguan sementara, logout, pencegahan hasil request terlambat setelah logout, dan pergantian token remembered di beberapa tab.
- UI: login/register, validasi, email duplikat, kegagalan koneksi/kredensial, password visibility, navigasi halaman terlindungi, pembatasan role dan penolakan redirect eksternal.
- Layout desktop 1440 × 1000 dan mobile lebar 360 px; tes memeriksa tidak ada overflow horizontal. Empat screenshot diperiksa secara visual untuk memastikan form dan teks tidak terpotong.

Screenshot:

- [Login desktop](login-desktop.png)
- [Register desktop](register-desktop.png)
- [Login mobile](login-mobile.png)
- [Register mobile](register-mobile.png)

## Batas hasil

Tes service/context memakai mock, sedangkan tes browser mengintersepsi endpoint `/api/v1/*` dan mengembalikan fixture kontrak. Fixture hanya terdapat pada kode tes. Aplikasi yang dijalankan biasa tetap menghubungi API yang dikonfigurasi dan tidak memiliki akun demo yang selalu berhasil.

Repository https://github.com/alexabilxiz/UAS_PROJEK_RPL_EventKu diperiksa ulang melalui branch `main`, `develop` dan `feature/qa-testing`; belum ditemukan implementasi backend Auth. Commit yang diperiksa dicatat pada [catatan mingguan](../README.md). Tidak ada uji langsung ke database PostgreSQL, server Auth Audrey, pengiriman email, CORS produksi atau deployment. Karena itu, integrasi nyata Minggu 11 masih perlu dilaksanakan ketika API tersedia.

Tes ini merupakan pemeriksaan implementasi frontend Bambang; status pada workbook QA Alexa dan bukti kontribusi anggota lain tidak diubah. Ketersediaan dokumen UTS dan diagram tidak dipakai sebagai bukti bahwa backend telah berjalan.
