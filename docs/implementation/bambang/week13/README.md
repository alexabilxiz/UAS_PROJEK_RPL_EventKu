# Implementasi Bambang Minggu 13

Bambang Herlambang · 5803024019 · Frontend Developer · 14 November 2026

## Acuan dan cakupan

Rincian Pekerjaan Individu Mingguan - Proyek EventKu, halaman 14: Bambang mengimplementasikan kalender event bulanan di frontend dan memperbaiki bug UI dari review Sprint 2. Implementasi melanjutkan Auth Minggu 9–11 serta katalog, pengajuan, dan RSVP Minggu 12. Notifikasi backend dan statistik penyelenggara merupakan bagian Audrey Gresia; validasi feature-freeze kelompok merupakan bagian Dustin.

## Hasil

| Kebutuhan | Implementasi |
|---|---|
| Kalender bulanan | Rute publik `/events/calendar`, susunan Senin–Minggu, tanggal hari ini, jumlah event per tanggal |
| Navigasi | Bulan sebelumnya/berikutnya, input bulan, tombol Hari ini, agenda semua tanggal atau tanggal terpilih |
| Integrasi Event | Memakai `listEvents` dan HTTP client yang sudah tersedia, hanya event publik disetujui, membaca seluruh halaman hasil |
| Zona waktu | Batas bulan dan pengelompokan tanggal mulai memakai WIB, terlepas dari zona waktu browser |
| Detail event | Tautan agenda membuka detail; tombol kembali mempertahankan pilihan bulan/tanggal |
| Responsif dan aksesibilitas | Sel ringkas pada 360 px, judul lengkap di agenda, tombol tanggal dapat dioperasikan dengan keyboard, label jumlah event, status tanggal dipilih/hari ini |
| Kondisi layanan | Loading, pesan bulan/tanggal kosong, error dan coba lagi, pembatalan request saat bulan diganti |

Kalender dibuat dengan React dan CSS grid agar sesuai struktur frontend tanpa dependensi tambahan. Library kalender pada pembagian kerja merupakan contoh tools. Parameter `month` dan `date` tersimpan di URL sehingga reload, tautan bersama, dan navigasi browser memulihkan pilihan.

Event beberapa hari tampil pada tanggal mulai WIB, dengan rentang lengkap pada detail. Kalender mengikuti semantik filter `startAt` endpoint katalog. Menampilkan event yang sudah berjalan sejak bulan sebelumnya memerlukan kontrak API rentang overlap yang belum tersedia.

## Perbaikan hasil review lokal Sprint 2

Tidak ditemukan log review Sprint 2 dalam repository. Temuan berikut berasal dari pemeriksaan kode lokal dan uji regresi pada pengerjaan ini, bukan klaim temuan reviewer tim.

| ID | Temuan dan reproduksi | Perbaikan |
|---|---|---|
| UI-13-01 | Mahasiswa memiliki lebih dari 20 RSVP mendatang; buka detail event yang pendaftarannya berada pada halaman kedua. Pemeriksaan sebelumnya hanya membaca halaman pertama sehingga tombol Daftar Event masih muncul. | `hasActiveRegistration` membaca halaman berikutnya sampai event aktif ditemukan atau seluruh halaman selesai. UI menampilkan Anda sudah terdaftar. Backend tetap memeriksa duplikasi secara atomik. |
| UI-13-02 | Detail hanya memiliki tombol kembali ke katalog. Pengunjung dari kalender kehilangan konteks bulan dan tanggal bila memakai tombol tersebut. | State navigasi membawa query kalender; detail mengembalikan bulan dan tanggal semula. Tautan dari katalog tetap mempertahankan filter katalog. |

## Kontrak integrasi

Contoh request November 2026 (nilai query di-URL-encode oleh HTTP client):

```text
GET /api/v1/events?from=2026-11-01T00:00:00%2B07%3A00&to=2026-12-01T00:00:00%2B07%3A00&page=1&limit=20
200 {data: [event], total: 21, page: 1}
GET /api/v1/events?...&page=2&limit=20
```

Kalender memvalidasi nomor halaman, menghapus ID duplikat antarhalaman, dan menolak hasil tidak lengkap/error agar tidak menampilkan bulan kosong atau parsial sebagai hasil berhasil. Batas pengaman 500 halaman mencegah request tanpa akhir pada API yang tidak konsisten; apabila terlampaui, UI meminta pengguna mencoba lagi atau memakai katalog.

## Menjalankan dan verifikasi

```powershell
cd frontend
npm ci
npm run dev:demo
# Buka http://127.0.0.1:5174/events/calendar
```

Untuk backend tim, gunakan `npm run dev` dan konfigurasi pada [panduan frontend](../../../../frontend/README.md). Mode demo memakai API lokal dalam memori; endpoint produksi tidak diganti oleh fixture.

```powershell
npm run build
npm test
npx playwright install chromium
npx playwright test --workers=2
```

Hasil pengujian dan screenshot dicatat pada [bukti verifikasi](evidence/verification.md). Pengujian browser menggunakan fixture kontrak, bukan bukti backend Audrey telah lolos integrasi. Pengujian terhadap API/database nyata serta review/merge tim masih perlu dilakukan ketika server dan aksesnya tersedia. Perubahan disiapkan lokal; tidak melakukan push atau mengubah status Jira.
