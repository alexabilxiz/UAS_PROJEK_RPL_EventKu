import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import PageShell from '../components/PageShell';
import { useAuth } from '../hooks/useAuth';
import { registrationService } from '../services/registrationService';
import { formatEventDate, formatEventTime, isEventTimestamp } from '../utils/events';
import '../styles/event-registration.css';

const loginUrl = `/login?redirect=${encodeURIComponent('/mahasiswa/pendaftaran')}`;
function canCancel(row) {
  return row.status === 'aktif' && isEventTimestamp(row.startAt) && Date.parse(row.startAt) > Date.now();
}

function listError(error) {
  return error.status === 401 ? 'Sesi Anda sudah berakhir. Masuk kembali untuk melihat pendaftaran.' : error.message;
}

function cancellationError(error) {
  if (error.status === 401) return 'Sesi Anda sudah berakhir. Masuk kembali untuk membatalkan pendaftaran.';
  if (error.status === 403) return 'Akun Anda tidak memiliki izin untuk membatalkan pendaftaran ini.';
  if (error.status === 404 || error.status === 409 || error.status === 422) {
    return 'Pendaftaran tidak dapat dibatalkan. Periksa status dan jadwal event terbaru.';
  }
  if (!error.status || error.status >= 500) {
    return 'Hasil pembatalan belum dapat dipastikan. Muat ulang daftar untuk memeriksa statusnya.';
  }
  return error.message;
}

function RegistrationCard({ row, confirming, pending, onAsk, onDismiss, onCancel }) {
  return <li className="registration-card">
    <span className="registration-card-icon"><Icon name="calendar" size={24} /></span>
    <div className="registration-card-content">
      <h2>{row.title || `Event ${row.eventId}`}</h2>
      <p>{formatEventDate(row.startAt)} {formatEventTime(row.startAt)}</p>
      {row.locationOrLink && <p>{row.locationOrLink}</p>}
      <Link to={`/events/${row.eventId}`}>Lihat detail event <Icon name="arrow-right" size={14} /></Link>
    </div>
    <div className="registration-card-actions">
      <span className={`registration-badge${row.status === 'dibatalkan' ? ' registration-badge-cancelled' : ''}`}>
        {row.status === 'aktif' ? 'Terdaftar' : 'Dibatalkan'}
      </span>
      {canCancel(row) && !confirming && <button className="secondary-button" type="button" disabled={pending} onClick={onAsk}>
        Batalkan pendaftaran
      </button>}
    </div>
    {confirming && <div className="registration-confirm">
      <p>Batalkan pendaftaran untuk <strong>{row.title || `event ${row.eventId}`}</strong>?</p>
      <div>
        <button className="primary-button" type="button" disabled={pending} onClick={onCancel}>
          {pending ? 'Membatalkan…' : 'Ya, batalkan'}
        </button>
        <button className="secondary-button" type="button" disabled={pending} onClick={onDismiss}>Kembali</button>
      </div>
    </div>}
  </li>;
}

function StudentRegistrations({ token, logout }) {
  const [scope, setScope] = useState('upcoming');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState({ loading: true });
  const [confirming, setConfirming] = useState(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(null);
  const [notice, setNotice] = useState('');
  const mutation = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    registrationService.list({ token, scope, page, signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setView({ result });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setView({ error });
      });
    return () => controller.abort();
  }, [token, scope, page, reload]);

  useEffect(() => () => mutation.current?.abort(), []);

  function resetView() {
    setConfirming(null);
    setFailure(null);
    setNotice('');
    setView({ loading: true });
  }

  function refresh() {
    resetView();
    setReload((value) => value + 1);
  }

  async function cancel(row) {
    if (mutation.current) return;
    if (!canCancel(row)) {
      setConfirming(null);
      setFailure({ message: 'Pendaftaran hanya dapat dibatalkan sebelum event dimulai.' });
      return;
    }
    const controller = new AbortController();
    mutation.current = controller;
    setPending(true);
    setFailure(null);
    setNotice('');
    try {
      await registrationService.cancel(row.registrationId, { token, signal: controller.signal });
      if (!controller.signal.aborted) {
        setConfirming(null);
        setNotice('Pendaftaran berhasil dibatalkan.');
        setView({ loading: true });
        setReload((value) => value + 1);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setFailure({ status: error.status, message: cancellationError(error) });
        setConfirming(null);
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
      mutation.current = null;
    }
  }

  const result = view.result;
  const currentPage = result?.page ?? page;
  const lastPage = Math.max(1, Math.ceil((result?.total ?? 0) / 20));
  const expired = view.error?.status === 401 || failure?.status === 401;

  return <div className="registrations-inner">
    <div className="registration-toolbar">
      <div className="registration-tabs" role="group" aria-label="Tampilkan pendaftaran">
        {[['upcoming', 'Mendatang'], ['history', 'Riwayat']].map(([value, label]) => (
          <button key={value} type="button" aria-pressed={scope === value} disabled={pending} onClick={() => {
            if (scope === value) return;
            resetView();
            setScope(value);
            setPage(1);
          }}>{label}</button>
        ))}
      </div>
      {result && <p>{result.total} pendaftaran</p>}
    </div>
    {notice && <p className="success-message" role="status">{notice}</p>}
    {failure && <p className="error-message" role="alert">{failure.message}</p>}
    {view.loading && <p className="registration-placeholder" role="status">Memuat pendaftaran…</p>}
    {view.error && <p className="error-message" role="alert">{listError(view.error)}</p>}
    {expired ? (
      <Link className="primary-button" to={loginUrl} onClick={logout}>Masuk kembali</Link>
    ) : (failure || view.error) && (
      <button className="secondary-button" type="button" onClick={refresh}>Muat ulang daftar</button>
    )}
    {result && !expired && <>
      {result.data.length ? <ul className="registration-list">
        {result.data.map((row) => <RegistrationCard key={row.registrationId} row={row}
          confirming={confirming === row.registrationId} pending={pending}
          onAsk={() => { setFailure(null); setConfirming(row.registrationId); }}
          onDismiss={() => setConfirming(null)} onCancel={() => cancel(row)} />)}
      </ul> : <div className="registration-placeholder">
        <p>{scope === 'upcoming' ? 'Belum ada pendaftaran mendatang.' : 'Belum ada riwayat pendaftaran.'}</p>
        <Link className="secondary-button" to="/events">Jelajahi event</Link>
      </div>}
      {(currentPage > 1 || lastPage > 1) && <nav className="registration-pagination" aria-label="Halaman pendaftaran">
        <button className="secondary-button" type="button" disabled={currentPage <= 1 || pending} onClick={() => {
          resetView();
          setPage(currentPage - 1);
        }}>Sebelumnya</button>
        <span>Halaman {currentPage} dari {Math.max(currentPage, lastPage)}</span>
        <button className="secondary-button" type="button" disabled={currentPage >= lastPage || pending} onClick={() => {
          resetView();
          setPage(currentPage + 1);
        }}>Berikutnya</button>
      </nav>}
    </>}
  </div>;
}

export default function RegistrationsPage() {
  const { user, token, logout } = useAuth();
  useEffect(() => { document.title = 'Pendaftaran saya | EventKu'; }, []);

  return <PageShell><section className="registrations-page">
    <div className="registrations-hero"><div>
      <div>
        <p className="eyebrow">RUANG MAHASISWA</p>
        <h1>Pendaftaran saya</h1>
        <p>Kelola pendaftaran event kampus dan lihat riwayatnya.</p>
      </div>
      <Link className="secondary-button" to="/events">Lihat semua event <Icon name="arrow-right" size={16} /></Link>
    </div></div>
    {user?.role === 'mahasiswa' && token
      ? <StudentRegistrations key={user.userId} token={token} logout={logout} />
      : <div className="registrations-inner"><p className="registration-placeholder">Daftar pendaftaran tersedia untuk akun mahasiswa.</p></div>}
  </section></PageShell>;
}
