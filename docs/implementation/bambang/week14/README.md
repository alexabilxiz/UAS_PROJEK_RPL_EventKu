# Implementasi Bambang Minggu 14

Bambang Herlambang · 5803024019 · Frontend Developer · 18 November 2026

Halaman 15 *Rincian Pekerjaan Individu Mingguan - Proyek EventKu* menugaskan Bambang memperbaiki bug frontend dari QA/UAT dan mengoptimasi tampilan mobile serta desktop. Perbaikan berikut berasal dari uji regresi frontend lokal. Laporan QA/UAT tim dan alamat API tim belum tersedia di workspace. Integrasi terhadap backend Audrey dan verifikasi temuan resmi tim masih menunggu kedua masukan tersebut.

## Temuan dan perbaikan

| ID | Temuan uji lokal | Perbaikan |
|---|---|---|
| FE-14-01 | Setelah permintaan daftar pendaftaran gagal, detail event tetap menawarkan **Daftar Event**. | Tampilkan kegagalan dan **Periksa ulang pendaftaran**. Tombol RSVP baru tersedia setelah pemeriksaan berhasil dan pendaftaran aktif tidak ditemukan. |
| FE-14-02 | Setelah kiriman RSVP mendapat respons 503, tombol kembali aktif meski server mungkin sudah menyimpan pendaftaran. | Wajibkan pemeriksaan status sebelum pengiriman ulang saat hasilnya tidak pasti atau API mengembalikan konflik. Jika pendaftaran sudah aktif, detail menampilkan status terdaftar. |
| FE-14-03 | Tautan **Daftar** tersembunyi dari navigasi katalog pada ponsel. | Tampilkan **Daftar** dan **Masuk** dalam baris yang sama pada 320 px. Tinggi area sentuh tautan minimal 44 px. |
| FE-14-04 | Tombol pengajuan dapat terpecah ke beberapa baris dengan lebar berbeda di layar sempit. | Susun tombol selebar kartu di layar hingga 520 px. Di desktop, tombol tetap sejajar agar urutannya mudah dipindai. |

Pemeriksaan RSVP dilakukan melalui daftar pendaftaran aktif. Backend tetap harus memastikan keunikan RSVP dan kapasitas secara atomik, termasuk saat permintaan datang bersamaan.

## Hasil verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `npm test` | 71 tes unit lulus di 7 file. |
| `npx playwright test --workers=2` | 36 tes Chromium lulus, termasuk 4 regresi Week 14. Cakupan mencakup autentikasi, katalog, pengajuan, RSVP, kalender, dan tampilan responsif. |
| `npm run build` | Build produksi berhasil. |
| `npm run dev:demo` | Chromium menjalankan alur tanpa intersepsi HTTP. Pengunjung membuka pendaftaran akun dari katalog 320 px. Mahasiswa dummy login, melakukan RSVP, membatalkan, dan melihat riwayat. Kalender dimuat di desktop 1440 px. Penyelenggara dummy menyimpan draft, memuat ulang halaman, dan mengirimkannya hingga **Menunggu Moderasi**. Tidak ada error JavaScript browser selama alur ini. |

## Bukti tampilan

- [Katalog publik dan navigasi 320 px](evidence/katalog-mobile-320.png)
- [Form dan tombol pengajuan 360 px](evidence/pengajuan-mobile-360.png)
- [Form dan tombol pengajuan 1440 px](evidence/pengajuan-desktop-1440.png)

Tangkapan layar berasal dari server demo lokal dengan data dummy. Jalankan perintah verifikasi dari folder `frontend`.
