import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { registrationService } from '../services/registrationService';
import { isEventTimestamp } from '../utils/events';
import '../styles/event-registration.css';

const registrationPath = '/mahasiswa/pendaftaran';

function remainingSeats(event) {
  if (Number.isInteger(event.availableSeats)) return event.availableSeats;
  if (Number.isInteger(event.quota) && Number.isInteger(event.reservedSeats)) {
    return Math.max(0, event.quota - event.reservedSeats);
  }
  return null;
}

function closedReason(event, seats) {
  if (event.status !== 'disetujui') return 'Pendaftaran belum dibuka untuk event ini.';
  if (!isEventTimestamp(event.endAt)) return 'Jadwal event belum dapat diperiksa.';
  if (Date.now() >= Date.parse(event.endAt)) return 'Event sudah berakhir.';
  if (seats !== null && seats <= 0) return 'Kuota pendaftaran penuh.';
  return '';
}

function registrationError(error) {
  if (error.status === 401) return 'Sesi Anda sudah berakhir. Masuk kembali untuk mendaftar.';
  if (error.status === 403) return 'Akun Anda belum memiliki izin untuk mendaftar.';
  if (error.status === 409) {
    return 'Pendaftaran ditolak karena kuota penuh, Anda sudah terdaftar, atau status event berubah. Periksa daftar pendaftaran Anda.';
  }
  if (isUncertainResponse(error)) {
    return 'Hasil pendaftaran belum dapat dipastikan. Periksa ulang status sebelum mencoba lagi.';
  }
  return error.message;
}

function isUncertainResponse(error) {
  return !error.status || error.status === 408 || error.status >= 500;
}

function StudentRegistration({ event, seats, token, loginUrl, logout }) {
  const [registration, setRegistration] = useState(null);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const request = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    registrationService.hasActiveRegistration(event.eventId, { token, signal: controller.signal })
      .then((existing) => {
        if (!controller.signal.aborted) {
          if (existing) setRegistration('existing');
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError({
            status: failure.status,
            message: failure.status === 401
              ? registrationError(failure)
              : 'Status pendaftaran belum dapat diperiksa. Coba periksa ulang.',
            recheck: true,
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [event.eventId, token, lookupAttempt]);

  useEffect(() => () => request.current?.abort(), []);

  function recheckRegistration() {
    setChecking(true);
    setError(null);
    setLookupAttempt((attempt) => attempt + 1);
  }

  async function register() {
    if (request.current || checking || registration || error?.recheck || error?.status === 401
      || closedReason(event, seats)) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    try {
      await registrationService.register(event.eventId, { token, signal: controller.signal });
      if (!controller.signal.aborted) setRegistration('confirmed');
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError({
          status: failure.status,
          message: registrationError(failure),
          recheck: failure.status === 409 || isUncertainResponse(failure),
        });
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
      request.current = null;
    }
  }

  const reason = closedReason(event, seats);
  return <>
    {error && <p className="error-message" role="alert">{error.message}</p>}
    {error?.status === 401 ? (
      <Link className="primary-button" to={loginUrl} onClick={logout}>Masuk kembali</Link>
    ) : error?.recheck ? (
      <button className="secondary-button" type="button" onClick={recheckRegistration}>Periksa ulang pendaftaran</button>
    ) : registration ? (
      <p className="success-message" role="status">
        {registration === 'confirmed' ? 'Pendaftaran berhasil.' : 'Anda sudah terdaftar di event ini.'}
      </p>
    ) : reason ? (
      <p className="rsvp-note">{reason}</p>
    ) : (
      <button className="primary-button" type="button" disabled={checking || pending} onClick={register}>
        {checking ? 'Memeriksa pendaftaran…' : pending ? 'Mendaftarkan…' : 'Daftar Event'}
      </button>
    )}
    <Link className="secondary-button" to={registrationPath}>Lihat pendaftaran saya</Link>
  </>;
}

export default function EventRegistration({ event }) {
  const { user, token, loading, logout } = useAuth();
  const loginUrl = `/login?redirect=${encodeURIComponent(`/events/${event.eventId}`)}`;
  const seats = remainingSeats(event);
  const reason = closedReason(event, seats);

  return <section className="rsvp-panel" aria-label="Pendaftaran event">
    {loading ? <p className="rsvp-note" role="status">Memeriksa sesi…</p>
      : user?.role === 'mahasiswa' && token ? (
        user.ukwmsVerified === true
          ? <StudentRegistration key={`${user.userId}:${event.eventId}`} {...{ event, seats, token, loginUrl, logout }} />
          : <p className="rsvp-note">RSVP khusus mahasiswa UKWMS terverifikasi.</p>
      ) : reason ? <p className="rsvp-note">{reason}</p>
        : user ? <p className="rsvp-note">RSVP khusus mahasiswa UKWMS terverifikasi.</p>
          : <Link className="primary-button" to={loginUrl}>Masuk untuk mendaftar</Link>}
  </section>;
}
