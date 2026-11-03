import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import PageShell from '../components/PageShell';

export default function RoleRoute({ roles }) {
  const { user, loading, sessionError, retrySession, logout } = useAuth();
  const location = useLocation();
  if (loading) return <div className="session-loader" role="status"><span className="spinner" />Memeriksa sesi Anda…</div>;
  if (!user && sessionError) return <PageShell><section className="status-panel"><h1>Sesi belum dapat diperiksa</h1><p role="alert">{sessionError}</p><button className="primary-button" onClick={retrySession}>Coba lagi</button><button className="text-button" onClick={logout}>Masuk dengan akun lain</button></section></PageShell>;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  if (roles && !roles.includes(user.role)) return <PageShell><section className="status-panel"><h1>Akses terbatas</h1><p>Akun Anda tidak memiliki akses ke halaman ini.</p><a className="primary-button" href="/dashboard">Kembali ke akun</a></section></PageShell>;
  return <Outlet />;
}
