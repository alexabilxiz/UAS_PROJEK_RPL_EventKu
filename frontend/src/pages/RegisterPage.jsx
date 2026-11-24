import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import PasswordField from '../components/PasswordField';
import { useAuth } from '../hooks/useAuth';
import { validateRegistration } from '../utils/auth';

export default function RegisterPage() {
  const { user, register, loading } = useAuth();
  const [values, setValues] = useState({ name: '', email: '', role: 'mahasiswa', organizationId: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const alert = useRef(null);
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Daftar | EventKu'; }, []);
  const change = (key) => (event) => { setValues((v) => ({ ...v, [key]: event.target.value })); setErrors((e) => ({ ...e, [key]: '' })); setError(''); };

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const invalid = validateRegistration(values);
    setErrors(invalid);
    if (Object.keys(invalid).length) { document.getElementById(Object.keys(invalid)[0])?.focus(); return; }
    lock.current = true;
    setSubmitting(true);
    try {
      // Send only fields specified by the API. Confirmation stays in the form.
      await register({ name: values.name.trim(), email: values.email.trim(), password: values.password, role: values.role, ...(values.role === 'penyelenggara' ? { organizationId: values.organizationId.trim() } : {}) });
      navigate('/login', { replace: true, state: { registered: true, organizer: values.role === 'penyelenggara' } });
    } catch (failure) {
      if (failure.name === 'AbortError') return;
      setError((failure.status === 409 && failure.fieldErrors?.email) || failure.message || 'Akun belum dapat dibuat. Silakan coba lagi.');
      setErrors(failure.fieldErrors || {});
      setTimeout(() => alert.current?.focus(), 0);
    } finally { lock.current = false; setSubmitting(false); }
  }

  if (user && !loading) return <Navigate to="/dashboard" replace />;
  return <AuthLayout>
    <div className="form-eyebrow">MULAI DARI SINI</div><h1>Mulai pengalamanmu</h1>
    <p className="form-intro">Buat akun untuk terhubung dengan kegiatan kampus.</p>
    <form noValidate onSubmit={submit} aria-busy={submitting}>
      {error && <p role="alert" className="error-message" ref={alert} tabIndex={-1}>{error}</p>}
      <FormField id="name" label="Nama lengkap" autoComplete="name" value={values.name} onChange={change('name')} error={errors.name} required disabled={submitting} />
      <FormField id="email" label="Email" type="email" autoComplete="email" placeholder="nama@ukwms.ac.id" value={values.email} onChange={change('email')} error={errors.email} required disabled={submitting} />
      <FormField id="role" label="Peran akun" error={errors.role} required
        hint={values.role === 'mahasiswa' ? 'RSVP memerlukan verifikasi status mahasiswa UKWMS.' : undefined}>
        <select value={values.role} onChange={change('role')} disabled={submitting}><option value="mahasiswa">Mahasiswa</option><option value="penyelenggara">Penyelenggara</option></select>
      </FormField>
      {values.role === 'penyelenggara' && <FormField id="organizationId" label="ID organisasi" value={values.organizationId} onChange={change('organizationId')} error={errors.organizationId} hint="Gunakan ID dari pengelola. Organisasi perlu diverifikasi admin sebelum mengajukan event." required disabled={submitting} />}
      <PasswordField id="password" value={values.password} onChange={change('password')} error={errors.password} hint="Minimal 8 karakter." autoComplete="new-password" disabled={submitting} />
      <PasswordField id="confirmPassword" label="Konfirmasi kata sandi" value={values.confirmPassword} onChange={change('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" disabled={submitting} />
      <button className="primary-button w-full" disabled={submitting || loading} type="submit">{submitting ? <><span className="spinner" />Membuat akun…</> : 'Buat akun'}</button>
    </form>
    <p className="switch-auth">Sudah punya akun? <Link to="/login">Masuk</Link></p>
  </AuthLayout>;
}
