import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABELS, ROLE_PATHS } from '../utils/auth';

export default function AccountPage({ rolePage }) {
  const { user, logout } = useAuth();
  const title = rolePage ? `Ruang ${ROLE_LABELS[rolePage].toLowerCase()}` : 'Beranda akun';
  useEffect(() => { document.title = `${title} | EventKu`; }, [title]);
  return <PageShell><section className="account-section">
    <div className="account-heading"><div><p className="eyebrow">AKUN EVENTKU</p><h1>{title}</h1><p>Selamat datang{user.name ? `, ${user.name}` : ''}. Anda masuk sebagai {ROLE_LABELS[user.role]}.</p></div><span className="account-badge"><Icon name="check" />Sesi terverifikasi</span></div>
    <div className="account-layout"><section className="profile-card"><h2>Informasi akun</h2><dl>
      <div><dt>Nama</dt><dd>{user.name || 'Tidak disertakan pada profil'}</dd></div><div><dt>Email</dt><dd>{user.email || 'Tidak disertakan pada profil'}</dd></div><div><dt>Peran</dt><dd>{ROLE_LABELS[user.role]}</dd></div><div><dt>ID akun</dt><dd>{user.userId}</dd></div>
      {user.organizationId && <div><dt>ID organisasi</dt><dd>{user.organizationId}</dd></div>}
      {user.role === 'penyelenggara' && <div><dt>Verifikasi organisasi</dt><dd>{user.organizationStatus === 'verified' ? 'Terverifikasi' : 'Belum terverifikasi'}</dd></div>}
    </dl></section><section className="account-next"><span className="feature-icon"><Icon name="calendar" size={26} /></span><h2>Akunmu sudah terhubung.</h2><p>{user.role === 'penyelenggara' ? 'Pengajuan kegiatan tersedia setelah organisasi terverifikasi dan fitur event dirilis.' : user.role === 'admin' ? 'Fitur moderasi dan pengelolaan organisasi akan ditambahkan pada tahap berikutnya.' : 'Daftar kegiatan, kalender, dan RSVP akan tersedia pada tahap pengembangan berikutnya.'}</p>
      {!rolePage && <Link className="primary-button" to={ROLE_PATHS[user.role]}>Buka ruang {ROLE_LABELS[user.role].toLowerCase()} <Icon name="arrow-right" /></Link>}
      <button className="text-button" onClick={logout}>Keluar dari akun</button>
    </section></div>
  </section></PageShell>;
}
