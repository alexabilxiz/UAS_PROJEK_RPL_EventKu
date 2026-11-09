# Implementasi Bambang Minggu 12

Bambang Herlambang · 5803024019 · Frontend Developer · 9 November 2026

| Fitur | Rute | Branch fitur |
|---|---|---|
| Katalog dan detail publik | `/events`, `/events/:eventId` | `feature/event-catalog` |
| Pengajuan penyelenggara | `/penyelenggara/event/ajukan` | `feature/event-submission` |
| RSVP mahasiswa | Detail event dan `/mahasiswa/pendaftaran` | `feature/event-rsvp` |

Ketiga branch berasal dari commit frontend Minggu 9–11 (`821364d`). Branch lokal `feature/bambang-week12` menggabungkan fitur untuk uji lintas halaman. `origin/develop` masih berada di commit `c1cf4d1` ketika diperiksa, sebelum frontend Minggu 9–11. Sinkronisasi basis tersebut diperlukan untuk review ke `develop` sesuai alur tim.

## Kontrak integrasi

Frontend menggunakan client HTTP Fetch yang sudah dipakai oleh Auth, dengan prefix `/api/v1`, sehingga pengaturan proxy, Bearer, dan penanganan error berlaku untuk kedua modul.

| Alur | Request | Respons |
|---|---|---|
| Katalog | `GET /categories`, `GET /events` dengan `q`, `category`, `organizer`, `date` atau `from`/`to`, `page`, dan `limit` | Daftar kategori aktif dan `{data,total,page}` |
| Detail | `GET /events/:id` | `{event}` publik berstatus `disetujui` |
| Simpan draft | `POST /events` dengan Bearer | `201 {eventId,status:"draft"}` |
| Kirim moderasi | `PATCH /events/:id/submit` dengan Bearer | `200 {status:"menunggu_moderasi"}` |
| RSVP | `POST /events/:id/registrations` dengan Bearer | `201 {registrationId,status:"aktif"}` |
| Daftar milik mahasiswa | `GET /registrations/me?scope=upcoming\|history&page=&limit=` dengan Bearer | `{data,page,total}` |
| Batalkan RSVP | `DELETE /registrations/:id` dengan Bearer | `200 {message}` |

Katalog menyimpan pencarian, kategori, ID organisasi penyelenggara, tanggal, dan halaman di URL. Rentang tanggal di UI mencakup hari terakhir. Request mengirim tengah malam WIB hari berikutnya sebagai batas akhir eksklusif.

Pengajuan mengirim waktu WIB dalam ISO 8601. Penyelenggara bisa menyimpan draft atau langsung mengirimkannya ke moderasi. ID draft tersimpan pada sesi tab untuk akun dan organisasi yang sama, sehingga pengajuan dapat dilanjutkan setelah refresh tanpa membuat draft kedua. Poster memakai URL HTTPS sesuai field `posterUrl`. Unggah berkas poster memerlukan endpoint dari backend.

Kode memakai nama field DTO camelCase pada kontrak rancangan. Detail struktur item kategori, event, dan pendaftaran masih perlu dicocokkan dengan respons backend. Backend memeriksa peran, verifikasi organisasi, kepemilikan, status, kuota, dan transaksi atomik. Pemilihan kategori atau status pada UI memberi panduan sebelum request dikirim.

Acuan adalah pembagian kerja Minggu 12 halaman 13, SRS EventKu v2, kontrak API §5.2–5.3 rancangan Minggu 6, dan ekspor Figma Home, Detail Event, Tambah Event, serta Dashboard Mahasiswa.

## Menjalankan dan menguji

Dari folder `frontend`, gunakan `npm ci` dan `npm run dev`. Atur `API_PROXY_TARGET` dari contoh `.env.example` jika API tersedia secara lokal. Cara menghubungkan host HTTPS tercantum di [panduan frontend](../../../../frontend/README.md).

Jalankan `npm run build`, `npm test`, dan `npm run test:e2e`. Suite browser menggunakan Chromium dari Playwright (`npx playwright install chromium`).

| Pemeriksaan | Hasil akhir |
|---|---|
| `npm run build` | Build produksi berhasil |
| `npm test` | 60 tes lulus |
| `npx playwright test --workers=2` | 24 tes Chromium lulus, termasuk 8 skenario Minggu 12 |

Tes Minggu 12 mencakup pencarian, filter dan paginasi katalog, rentang tanggal WIB, tampilan ponsel 360 px, kembali ke detail setelah login, RSVP dan pembatalan, konflik RSVP, simpan draft, pengajuan ulang setelah kegagalan, serta pembatasan akses berdasarkan peran dan verifikasi organisasi.

Screenshot dari pengujian dengan data simulasi tersedia untuk [katalog](evidence/katalog-event.png), [pengajuan](evidence/pengajuan-event.png), dan [RSVP](evidence/rsvp-event.png).

Pemeriksaan GitHub pada 9 November 2026 menemukan frontend pada `main`, sedangkan branch `develop` dan `feature/qa-testing` berisi dokumentasi. Alur browser menggunakan fixture API. Pengujian dengan server Auth/Event nyata masih menunggu akses API, termasuk uji izin, pemetaan DTO, dan konsistensi kuota saat beberapa mahasiswa mendaftar bersamaan.
