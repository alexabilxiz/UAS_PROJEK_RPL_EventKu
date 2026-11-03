import { Link } from 'react-router-dom';
import Brand from './Brand';
import Icon from './Icon';

export default function AuthLayout({ children }) {
  return (
    <main className="auth-layout" id="main-content">
      <aside className="auth-story" aria-label="Tentang EventKu">
        <Brand />
        <div className="story-content">
          <p className="story-eyebrow">Lebih dekat dengan kehidupan kampus</p>
          <h2 className="story-title">Satu akun untuk banyak pengalaman.</h2>
          <p className="story-copy">Jelajahi kegiatan, simpan yang menarik, dan kelola semua pendaftaranmu di satu tempat.</p>
          <img className="campus-photo" src={`${import.meta.env.BASE_URL}campus.jpg`} alt="Gedung Universitas Katolik Widya Mandala Surabaya" width="327" height="189" />
        </div>
        <p className="story-footer">Temukan ruang untuk belajar, bertemu, dan berkembang.</p>
      </aside>
      <section className="auth-main" aria-label="Akses akun EventKu">
        <Link className="back-link" to="/"><Icon name="arrow-left" size={17} />Kembali ke beranda</Link>
        <div className="auth-card">{children}</div>
      </section>
    </main>
  );
}
