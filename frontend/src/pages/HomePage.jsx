import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import Icon from '../components/Icon';

export default function HomePage() {
  useEffect(() => { document.title = 'EventKu — Kegiatan kampus, lebih dekat'; }, []);
  return <PageShell>
    <section className="home-hero">
      <div><p className="eyebrow">UNTUK KOMUNITAS KAMPUS</p><h1>Pengalaman baru,<br /><span>dimulai dari sini.</span></h1><p>Kegiatan, pertemuan, dan kesempatan untuk berkembang. Siapkan akunmu untuk terhubung dengan kehidupan kampus.</p><div className="hero-actions"><Link className="primary-button" to="/register">Buat akun EventKu <Icon name="arrow-right" /></Link><Link className="secondary-button" to="/login">Saya sudah punya akun</Link></div><p className="home-scope">Akses akun sudah tersedia. Katalog dan pendaftaran kegiatan akan hadir pada tahap berikutnya.</p></div>
      <div className="hero-image"><img src="/campus.jpg" alt="Universitas Katolik Widya Mandala Surabaya" /><div className="hero-caption"><Icon name="calendar" size={24} /><div><strong>Kampusmu, ceritamu.</strong><span>Temukan lebih banyak pengalaman.</span></div></div></div>
    </section>
    <section className="home-intro"><p className="eyebrow">SATU AKUN EVENTKU</p><h2>Ruang untuk setiap peran.</h2><div className="role-grid">{[
      ['user', 'Mahasiswa', 'Siapkan akun untuk mengikuti kegiatan kampus dan mengelola pendaftaranmu.'],
      ['calendar', 'Penyelenggara', 'Daftarkan akun organisasi. Verifikasi diperlukan sebelum mengajukan kegiatan.'],
      ['shield', 'Admin', 'Masuk menggunakan akun yang diberikan pengelola untuk menjalankan administrasi.'],
    ].map(([icon, title, copy]) => <article key={title}><span className="feature-icon"><Icon name={icon} size={24} /></span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
  </PageShell>;
}
