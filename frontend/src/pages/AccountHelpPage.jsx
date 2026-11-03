import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

export default function AccountHelpPage() {
  return <AuthLayout><div className="form-eyebrow">BANTUAN AKUN</div><h1>Perlu mengakses akun?</h1><p className="form-intro">Pemulihan kata sandi melalui email belum tersedia pada versi ini. Hubungi pengelola EventKu melalui kanal kampus untuk meminta bantuan akses.</p><p className="form-note">Jangan membagikan kata sandi atau token masuk kepada pihak lain.</p><Link className="primary-button w-full" to="/login">Kembali ke halaman masuk</Link></AuthLayout>;
}
