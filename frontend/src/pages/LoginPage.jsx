import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import PasswordField from '../components/PasswordField';
import { useAuth } from '../hooks/useAuth';
import { safeReturnPath, validateLogin } from '../utils/auth';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const [values, setValues] = useState({ email: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const alert = useRef(null);
  const submitLock = useRef(false);
  useEffect(() => { document.title = 'Masuk | EventKu'; }, []);
  const change = (key) => (event) => { setValues((v) => ({ ...v, [key]: key === 'remember' ? event.target.checked : event.target.value })); setErrors((e) => ({ ...e, [key]: '' })); setError(''); };

  async function submit(event) {
    event.preventDefault();
    if (submitLock.current) return;
    const invalid = validateLogin(values);
    setErrors(invalid);
    if (Object.keys(invalid).length) { document.getElementById(Object.keys(invalid)[0])?.focus(); return; }
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      await login(values);
      setValues((v) => ({ ...v, password: '' }));
      navigate(safeReturnPath(params.get('redirect')), { replace: true });
    } catch (failure) {
      if (failure.name === 'AbortError') return;
      setError(failure.message || 'Belum berhasil masuk. Silakan coba lagi.');
      setErrors(failure.fieldErrors || {});
      setTimeout(() => alert.current?.focus(), 0);
    } finally { submitLock.current = false; setSubmitting(false); }
  }

  if (user && !loading) return <Navigate to={safeReturnPath(params.get('redirect'))} replace />;
  return <AuthLayout>
    <div className="form-eyebrow">SELAMAT DATANG KEMBALI</div>
    <h1>Masuk ke EventKu</h1>
    <p className="form-intro">Lanjutkan pengalaman kampusmu dalam satu akun.</p>
    {location.state?.registered && <p className="success-message" role="status">Akun berhasil dibuat. Silakan masuk.{location.state.organizer ? ' Akun penyelenggara menunggu verifikasi organisasi.' : ''}</p>}
    <form noValidate onSubmit={submit} aria-busy={submitting}>
      {error && <p className="error-message" role="alert" ref={alert} tabIndex={-1}>{error}</p>}
      <FormField id="email" label="Email" type="email" autoComplete="username" placeholder="nama@ukwms.ac.id" value={values.email} onChange={change('email')} error={errors.email} required disabled={submitting} />
      <PasswordField id="password" value={values.password} onChange={change('password')} error={errors.password} disabled={submitting} />
      <div className="form-options"><label className="checkbox-label"><input type="checkbox" checked={values.remember} onChange={change('remember')} disabled={submitting} /> Ingat saya</label><Link to="/bantuan-akun">Lupa kata sandi?</Link></div>
      <button className="primary-button w-full" disabled={submitting || loading} type="submit">{submitting ? <><span className="spinner" />Memeriksa akun…</> : 'Masuk'}</button>
    </form>
    <p className="switch-auth">Belum punya akun? <Link to="/register">Daftar di sini</Link></p>
    <p className="form-note">Mahasiswa, penyelenggara, dan admin masuk dengan akun masing-masing.</p>
  </AuthLayout>;
}
