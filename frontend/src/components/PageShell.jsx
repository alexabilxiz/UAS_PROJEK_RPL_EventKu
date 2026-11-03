import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Brand from './Brand';
import Icon from './Icon';

export default function PageShell({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="page-shell">
      <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="site-nav" aria-label="Navigasi utama">
            <Link to="/">Beranda</Link>
            {user ? <>
              <Link to="/dashboard">Akun saya</Link>
              <button className="button button-secondary logout-button" type="button" onClick={logout}><Icon name="logout" size={17} />Keluar</button>
            </> : <>
              <Link className="nav-register" to="/register">Daftar</Link>
              <Link className="button button-primary" to="/login">Masuk<Icon name="arrow-right" size={17} /></Link>
            </>}
          </nav>
        </div>
      </header>
      <main className="page-content" id="main-content">{children}</main>
      <footer className="site-footer">
        <div><Brand compact /><p>Satu tempat untuk semua kegiatan kampus.</p></div>
        <p>EventKu untuk komunitas kampus.</p>
      </footer>
    </div>
  );
}
