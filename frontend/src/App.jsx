import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccountPage from './pages/AccountPage';
import AccountHelpPage from './pages/AccountHelpPage';
import PageShell from './components/PageShell';
import RoleRoute from './routes/RoleRoute';

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/bantuan-akun" element={<AccountHelpPage />} />
    <Route element={<RoleRoute />}><Route path="/dashboard" element={<AccountPage />} /></Route>
    {['mahasiswa', 'penyelenggara', 'admin'].map((role) => <Route key={role} element={<RoleRoute roles={[role]} />}><Route path={`/${role}`} element={<AccountPage rolePage={role} />} /></Route>)}
    <Route path="*" element={<PageShell><section className="status-panel"><p className="eyebrow">404</p><h1>Halaman tidak ditemukan</h1><p>Periksa kembali alamat halaman yang Anda buka.</p><Link className="primary-button" to="/">Kembali ke beranda</Link></section></PageShell>} />
  </Routes>;
}
