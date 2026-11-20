import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import PasswordField from '../components/PasswordField';
import { useFormAction } from '../hooks/useFormAction';
import { authService } from '../services/authService';
import { validateNewPassword } from '../utils/auth';

export default function AccountHelpPage() {
  const [email, setEmail] = useState('');
  const form = useFormAction();
  useEffect(() => { document.title = 'Pemulihan akun | EventKu'; }, []);
  return <AuthLayout>
    <h1>Pulihkan akun</h1>
    <p className="form-intro">Masukkan email akun untuk meminta tautan atur ulang kata sandi.</p>
    <form onSubmit={(event) => {
      event.preventDefault();
      form.run((signal) => authService.requestReset(email.trim(), { signal }), 'Jika akun tersedia, tautan pemulihan akan dikirim.');
    }}>
      <FormField id="recovery-email" label="Email" required type="email" autoComplete="email" value={email}
        disabled={form.busy} onChange={({ target }) => setEmail(target.value)} />
      <button className="primary-button w-full" disabled={form.busy}>Kirim tautan pemulihan</button>
    </form>
    {form.error && <p className="form-note" role="alert">{form.error}</p>}
    {form.message && <p className="form-note" role="status">{form.message}</p>}
    {form.result && <Link className="secondary-button w-full" to={form.result}>Buka tautan pemulihan demo</Link>}
    <p className="switch-auth"><Link to="/login">Kembali ke halaman masuk</Link></p>
  </AuthLayout>;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const validToken = /^[A-Za-z0-9._~-]{16,512}$/.test(token);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [validation, setValidation] = useState('');
  const form = useFormAction();
  useEffect(() => { document.title = 'Atur ulang kata sandi | EventKu'; }, []);
  return <AuthLayout>
    <h1>Atur ulang kata sandi</h1>
    {!validToken && <p role="alert">Tautan pemulihan tidak valid.</p>}
    {validToken && !form.message && <form onSubmit={(event) => {
      event.preventDefault();
      const error = validateNewPassword(password, confirm);
      setValidation(error);
      if (!error) form.run((signal) => authService.resetPassword(token, password, { signal }), 'Kata sandi berhasil diatur ulang.');
    }}>
      <PasswordField id="reset-password" label="Kata sandi baru" autoComplete="new-password" hint="8 sampai 128 karakter."
        value={password} onChange={({ target }) => setPassword(target.value)} disabled={form.busy} />
      <PasswordField id="reset-confirm" label="Konfirmasi kata sandi" autoComplete="new-password"
        value={confirm} onChange={({ target }) => setConfirm(target.value)} disabled={form.busy} />
      {(validation || form.error) && <p className="form-note" role="alert">{validation || form.error}</p>}
      <button className="primary-button w-full" disabled={form.busy}>Atur ulang kata sandi</button>
    </form>}
    {form.message && <p className="form-note" role="status">{form.message}</p>}
    <p className="switch-auth"><Link to={form.message ? '/login' : '/bantuan-akun'}>
      {form.message ? 'Masuk dengan kata sandi baru' : 'Minta tautan pemulihan baru'}</Link></p>
  </AuthLayout>;
}
