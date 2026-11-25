# Panduan Singkat & Formulir UAT Pengguna — EventKu (Minggu 14)

**Tujuan:** Melengkapi **Bagian 23 (UAT bersama Pengguna)** dan **Bagian 26 (Kesimpulan)** pada [EventKu_Laporan_Akhir_Kelompok_IV.tex](EventKu_Laporan_Akhir_Kelompok_IV.tex) dengan bukti uji nyata bersama **3–5 penguji** (estimasi waktu: **15–20 menit**).  
**Koordinator:** Dustin Pranata Wangsawidjaja (PM/BA) & Alexa Bilxiz Aulia (QA/DevOps).

---

## 1. Persiapan Sebelum Mulai (5 Menit)

Pilih salah satu lingkungan pengujian dan catat pilihan yang dipakai secara jujur:
- **Opsi A (Direkomendasikan bila sudah live):** Gunakan URL situs produksi (Vercel/Cloudflare + Render + Neon PostgreSQL).
- **Opsi B (Lokal di 1 laptop — cepat untuk Minggu 14):**
  1. Jalankan backend & frontend lokal terhubung ke PostgreSQL lokal/Neon (`cd backend && npm run dev` dan `cd frontend && npm run dev`), **atau**
  2. Jika database belum siap, jalankan mode demo lokal (`cd frontend && npm run dev:demo` di `http://127.0.0.1:5174`) dengan akun demo bawaan:
     - **Admin:** `admin@demo.test` / `EventKuDemo123!`
     - **Penyelenggara (terverifikasi):** `penyelenggara@demo.test` / `EventKuDemo123!`
     - **Mahasiswa UKWMS:** `mahasiswa@demo.test` / `EventKuDemo123!`

> **Aturan penting:** Jangan mengisi nama penguji, hasil, atau komentar fiktif. Catat hasil apa adanya sesuai yang benar-benar dialami penguji.

---

## 2. Daftar Peserta Penguji (Isi 3–5 Orang)

| No | Nama / Inisial | Peran yang Diuji | Tanggal | Lingkungan (Lokal / Demo / Live) |
|---|---|---|---|---|
| 1 | `[ISI]` | Mahasiswa | `[ISI]` | `[ISI]` |
| 2 | `[ISI]` | Mahasiswa | `[ISI]` | `[ISI]` |
| 3 | `[ISI]` | Penyelenggara | `[ISI]` | `[ISI]` |
| 4 | `[ISI]` | Admin | `[ISI]` | `[ISI]` |
| 5 *(opsional)* | `[ISI]` | Mahasiswa / Penyelenggara | `[ISI]` | `[ISI]` |

---

## 3. Langkah & Formulir 5 Skenario UAT

Minta setiap penguji menjalankan skenario sesuai perannya di browser (laptop atau ponsel 360 px) lalu catat hasilnya:

### `UAT-01` — Mahasiswa: Registrasi, Login, Cari Event, dan RSVP
1. Buka `/register`, daftar sebagai **Mahasiswa** dengan email `@student.ukwms.ac.id` (atau login memakai akun mahasiswa UKWMS).
2. Buka `/events`, coba cari dengan kata kunci atau filter kategori/tanggal.
3. Buka detail salah satu event yang masih punya kuota, lalu klik **Daftar Event**.
4. **Kriteria Lulus:** Akun berhasil masuk, event ditemukan sesuai filter, status berubah menjadi terdaftar, dan sisa kuota berkurang 1.

### `UAT-02` — Penyelenggara: Ajukan Event & Lihat Hasil Moderasi
1. Login sebagai **Penyelenggara** (organisasi terverifikasi).
2. Buka `/penyelenggara/event/ajukan`, isi judul, deskripsi, kategori, jadwal masa depan (WIB), lokasi, poster (URL HTTPS atau unggah gambar), dan kuota → klik **Ajukan event**.
3. Pastikan status menjadi **Menunggu Moderasi** (dan belum tampil di katalog publik `/events`).
4. Setelah admin memoderasi (`UAT-03`), buka `/penyelenggara/notifikasi` dan cek notifikasi hasil moderasi.
5. **Kriteria Lulus:** Event masuk antrean moderasi dan notifikasi hasil moderasi diterima penyelenggara.

### `UAT-03` — Admin: Moderasi Event (Setujui & Tolak dengan Alasan)
1. Login sebagai **Admin**, buka `/admin/moderasi`.
2. Uji **Tolak** pada satu event tanpa mengisi alasan (harus ditolak oleh validasi), lalu isi alasan penolakan dan tolak (atau uji pada event uji kedua).
3. Uji **Setujui** pada event dari `UAT-02` → cek `/events` bahwa event tersebut langsung tampil di katalog publik dan tercatat di `/admin/moderasi/riwayat`.
4. **Kriteria Lulus:** Penolakan mewajibkan alasan; event disetujui tampil di katalog publik; keputusan tercatat di riwayat.

### `UAT-04` — Mahasiswa: Batalkan RSVP & Lihat Kalender Event
1. Login sebagai **Mahasiswa** yang sudah mendaftar di `UAT-01`.
2. Buka `/events/calendar`, pastikan event yang disetujui tampil pada tanggal yang tepat (WIB) dan coba pindah bulan / filter kategori.
3. Buka `/mahasiswa/pendaftaran` (atau halaman detail event), lalu klik **Batalkan pendaftaran**.
4. **Kriteria Lulus:** Kalender menampilkan event dengan benar; pembatalan berhasil dan kuota event bertambah kembali 1.

### `UAT-05` — Penyelenggara: Lihat & Ekspor CSV Daftar Peserta
1. Login sebagai **Penyelenggara** pemilik event yang memiliki minimal 1 peserta aktif.
2. Buka `/penyelenggara/event` → pilih event → buka halaman **Peserta**.
3. Klik tombol **Ekspor CSV** dan buka file `.csv` yang terunduh.
4. **Kriteria Lulus:** Daftar peserta tampil sesuai pendaftar aktif dan file CSV memuat header + baris data peserta dengan benar.

---

## 4. Tabel Rekap Hasil (Salin ke Bagian 23 Laporan Akhir)

| ID | Skenario | Penguji | Hasil (`Lulus` / `Gagal`) | Umpan Balik / Catatan Penguji |
|---|---|---|---|---|
| `UAT-01` | Mahasiswa mendaftar akun, login, mencari event, dan RSVP. | `[ISI]` | `[ISI]` | `[ISI]` |
| `UAT-02` | Penyelenggara mengajukan event dan melihat hasil moderasi. | `[ISI]` | `[ISI]` | `[ISI]` |
| `UAT-03` | Admin memoderasi event (setujui dan tolak dengan alasan). | `[ISI]` | `[ISI]` | `[ISI]` |
| `UAT-04` | Mahasiswa membatalkan RSVP dan melihat kalender event. | `[ISI]` | `[ISI]` | `[ISI]` |
| `UAT-05` | Penyelenggara mengekspor daftar peserta. | `[ISI]` | `[ISI]` | `[ISI]` |

**Ringkasan untuk Bagian 23 & 26:**
- Jumlah skenario lulus: `[ISI] dari 5`
- Temuan / saran penguji: `[ISI]`
- Temuan yang sudah diperbaiki: `[ISI]`
- Keputusan penerimaan akhir (Bagian 26): `[ISI: Diterima / Diterima dengan catatan / Belum diterima]`
