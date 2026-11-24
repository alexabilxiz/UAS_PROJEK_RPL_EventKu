# Verifikasi frontend Bambang sampai Minggu 13

Tanggal: 14 November 2026. Lingkungan: Windows, Node.js 22.16.0, npm 10.9.2, Chromium Playwright 1248.

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` | Lulus, bundle produksi berhasil dibuat |
| `npm test` | 71 tes lulus pada 7 file, termasuk 10 tes baru kalender dan pencarian RSVP lintas halaman |
| Skenario lama `auth.spec.js` dan `events.spec.js` | 25 tes Chromium lulus pada eksekusi gabungan |
| `npx playwright test e2e/calendar.spec.js --workers=2` | 7 tes Chromium lulus setelah perbaikan fixture error API |
| Smoke test `npm run dev:demo` | Kalender membaca 10 event November 2026 dari middleware demo Vite tanpa intersepsi request; detail dan tombol kembali berhasil, tidak ada error JavaScript browser |
| Tampilan 360 × 800 | Tidak ada scroll horizontal; pemilihan tanggal lewat keyboard berhasil |
| Pemeriksaan visual | Screenshot desktop dan ponsel diperiksa; tanggal, label, agenda, dan navigasi terbaca tanpa tumpang tindih |
| `git diff --check` untuk file tracked yang diubah pada tugas ini | Lulus; perubahan laporan UTS yang sudah ada sebelum tugas berada di luar pemeriksaan ini |

## Skenario baru

1. Batas bulan WIB inklusif/eksklusif, pengelompokan event UTC malam ke hari berikutnya WIB, detail dan kembali dengan tanggal terpilih, reload URL.
2. Bulan sebelumnya/berikutnya, tanggal kosong, semua tanggal, bulan tanpa event, dan tombol kembali browser.
3. API 503 menampilkan error; Coba lagi memuat kalender setelah API pulih.
4. Bulan dengan 21 event membaca halaman kedua, sehingga event terakhir dan jumlah per tanggal tetap lengkap.
5. Parameter bulan/tanggal URL invalid ditangani; Hari ini mengikuti WIB pada batas bulan UTC.
6. Kalender ponsel 360 px, tanpa overflow horizontal, Enter memilih tanggal yang sedang fokus.
7. Regresi Sprint 2: RSVP aktif pada halaman kedua menampilkan status sudah terdaftar dan menyembunyikan tombol Daftar Event.

Tes unit tambahan mencakup Februari tahun kabisat/nonkabisat, kisi dimulai Senin, bulan dengan enam pekan, pergantian tahun, validasi bulan, pengurutan agenda, halaman API berulang, kegagalan halaman lanjutan, dan RSVP dibatalkan.

## Catatan pelaksanaan

Percobaan browser pertama belum dapat memulai Chromium karena binary belum terpasang pada profil Windows. `npx playwright install chromium` berhasil memasangnya, kemudian pengujian dijalankan kembali. Pada eksekusi gabungan, 31 dari 32 tes lulus; satu fixture error API hanya menggagalkan request pertama, sedangkan React StrictMode membuat request pengganti yang berhasil. Fixture diperbaiki agar API tetap gagal sampai tahap Coba lagi. Seluruh 7 skenario kalender lalu lulus. Tidak ada kegagalan produk tersisa dari pemeriksaan tersebut.

## Bukti visual

- [Kalender desktop dengan fixture kontrak](kalender-desktop.png)
- [Kalender ponsel dengan fixture kontrak](kalender-mobile.png)
- [Kalender demo lokal dengan 10 event](kalender-demo.png)

Screenshot fixture memakai November 2035 untuk data uji deterministik. Screenshot demo memakai November 2026 dengan tanggal kegiatan relatif terhadap waktu server demo. Semua data ini simulasi, bukan pendaftaran nyata.

## Batas verifikasi

Pengujian fixture dan demo lokal membuktikan perilaku frontend serta kecocokan dengan kontrak API yang tersedia di kode. Ketersediaan, otorisasi, pagination, validasi waktu, dan respons DTO backend Audrey belum diuji terhadap server tim. Backend tetap harus menegakkan keunikan RSVP, verifikasi akun/organisasi, dan kuota secara atomik. Status feature-freeze kelompok, QA/UAT Minggu 14, merge/push, dan perubahan Jira tidak dinyatakan selesai oleh hasil ini.
