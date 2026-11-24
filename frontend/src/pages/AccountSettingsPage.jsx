import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../components/FormField';
import PageShell from '../components/PageShell';
import PasswordField from '../components/PasswordField';
import { useAuth } from '../hooks/useAuth';
import { useFormAction } from '../hooks/useFormAction';
import { authService } from '../services/authService';
import { isHttpsPoster } from '../utils/eventSubmission';
import { validateNewPassword } from '../utils/auth';
import '../styles/workspace.css';

function FormFeedback({ form, validation }) {
  return <>
    {(validation || form.error) && <p className="workspace-feedback workspace-error" role="alert">{validation || form.error}</p>}
    {form.message && !validation && <p className="workspace-feedback" role="status">{form.message}</p>}
  </>;
}

function ProfileForm({ user, updateProfile }) {
  const [name, setName] = useState(user.name);
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl ?? '');
  const [validation, setValidation] = useState('');
  const form = useFormAction();
  return <form className="workspace-card workspace-stack" onSubmit={(event) => {
    event.preventDefault();
    const photo = photoUrl.trim();
    const error = !name.trim() ? 'Isi nama lengkap.' : photo && !isHttpsPoster(photo) ? 'Gunakan URL foto HTTPS.' : '';
    setValidation(error);
    if (!error) form.run((signal) => updateProfile({ name: name.trim(), photoUrl: photo }, { signal }), 'Profil diperbarui.');
  }}>
    <h2>Profil</h2>
    <FormField id="profile-name" label="Nama lengkap" required maxLength={100} autoComplete="name" value={name}
      onChange={({ target }) => setName(target.value)} disabled={form.busy} />
    <FormField id="profile-photo" label="URL foto profil" type="url" maxLength={2048} value={photoUrl}
      onChange={({ target }) => setPhotoUrl(target.value)} disabled={form.busy} />
    <FormFeedback form={form} validation={validation} />
    <div className="workspace-actions"><button className="primary-button" disabled={form.busy}>Simpan profil</button></div>
  </form>;
}

function ChangePasswordForm({ token }) {
  const [currentPassword, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [validation, setValidation] = useState('');
  const form = useFormAction();
  return <form className="workspace-card workspace-stack" onSubmit={(event) => {
    event.preventDefault();
    const error = validateNewPassword(password, confirm);
    setValidation(error);
    if (!error) form.run(async (signal) => {
      await authService.changePassword({ currentPassword, password }, { token, signal });
      if (!signal.aborted) { setCurrent(''); setPassword(''); setConfirm(''); }
    }, 'Kata sandi diperbarui.');
  }}>
    <h2>Ubah kata sandi</h2>
    <PasswordField id="current-password" label="Kata sandi saat ini" value={currentPassword} disabled={form.busy} onChange={({ target }) => setCurrent(target.value)} />
    <PasswordField id="new-password" label="Kata sandi baru" autoComplete="new-password" value={password} disabled={form.busy} onChange={({ target }) => setPassword(target.value)} />
    <PasswordField id="confirm-new-password" label="Konfirmasi kata sandi baru" autoComplete="new-password" value={confirm} disabled={form.busy} onChange={({ target }) => setConfirm(target.value)} />
    <FormFeedback form={form} validation={validation} />
    <div className="workspace-actions"><button className="primary-button" disabled={form.busy}>Simpan kata sandi baru</button></div>
  </form>;
}

export default function AccountSettingsPage() {
  const { user, token, updateProfile } = useAuth();
  useEffect(() => { document.title = 'Pengaturan akun | EventKu'; }, []);
  return <PageShell><section className="account-section workspace-page">
    <div className="account-heading"><h1>Pengaturan akun</h1><Link className="secondary-button" to="/dashboard">Kembali ke akun</Link></div>
    <div className="workspace-list">
      <ProfileForm key={user.userId} user={user} updateProfile={updateProfile} />
      <ChangePasswordForm key={token} token={token} />
    </div>
  </section></PageShell>;
}
