import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { useAuth } from '../hooks/useAuth';
import {
  listPendingEvents, moderateEvent, MODERATION_PAGE_SIZE, REJECTION_REASON_LIMIT,
} from '../services/eventModerationService';
import { formatEventDate, formatEventTime, safeEventLink } from '../utils/events';
import '../styles/event-moderation.css';

function ModerationDecision({ decision, pending, onCancel, onSubmit }) {
  const [reason, setReason] = useState('');
  const rejecting = decision === 'ditolak';

  return <form className="moderation-decision" onSubmit={(event) => {
    event.preventDefault();
    if (!rejecting || reason.trim()) onSubmit(reason);
  }}>
    {rejecting ? <label>
      Alasan penolakan
      <textarea required rows={3} maxLength={REJECTION_REASON_LIMIT} disabled={pending}
        value={reason} onChange={(event) => setReason(event.target.value)} />
    </label> : <p>Event yang disetujui akan tampil di katalog publik.</p>}
    <div className="moderation-actions">
      <button className="primary-button" type="submit" disabled={pending || (rejecting && !reason.trim())}>
        {pending ? 'Menyimpan…' : rejecting ? 'Konfirmasi penolakan' : 'Setujui dan publikasikan'}
      </button>
      <button className="secondary-button" type="button" disabled={pending} onClick={onCancel}>Batal</button>
    </div>
  </form>;
}

function ModerationCard({ event, decision, pending, onChoose, onCancel, onSubmit }) {
  const locationUrl = safeEventLink(event.locationOrLink);
  return <li className="moderation-card">
    <h2>{event.title}</h2>
    <p className="moderation-meta">
      {[event.organizationName || event.organizationId, event.categoryName || event.categoryId]
        .filter(Boolean).join(' · ')}
    </p>
    <details className="moderation-details">
      <summary>Lihat detail pengajuan</summary>
      <p className="moderation-description">{event.description || 'Deskripsi belum tersedia.'}</p>
      <dl>
        <div><dt>Mulai</dt><dd>{formatEventDate(event.startAt)} {formatEventTime(event.startAt)}</dd></div>
        <div><dt>Selesai</dt><dd>{formatEventDate(event.endAt)} {formatEventTime(event.endAt)}</dd></div>
        <div><dt>Lokasi atau tautan</dt><dd>{locationUrl
          ? <a href={locationUrl} target="_blank" rel="noreferrer">{event.locationOrLink}</a>
          : event.locationOrLink || 'Belum tersedia'}</dd></div>
        {event.audience && <div><dt>Ketentuan peserta</dt><dd>{event.audience}</dd></div>}
        {event.registrationMode === 'external'
          ? <div><dt>Pendaftaran</dt><dd>{event.registrationUrl
            ? <a href={event.registrationUrl} target="_blank" rel="noreferrer">Buka tautan panitia</a>
            : 'Tautan belum tersedia'}</dd></div>
          : <div><dt>Kuota</dt><dd>{event.quota ?? 'Belum tersedia'}</dd></div>}
        {event.posterUrl && <div><dt>Poster</dt><dd><a href={event.posterUrl} target="_blank" rel="noreferrer">Buka poster</a></dd></div>}
      </dl>
    </details>
    {decision ? <ModerationDecision key={decision} decision={decision} pending={pending}
      onCancel={onCancel} onSubmit={onSubmit} /> : <div className="moderation-actions">
      <button className="primary-button" type="button" disabled={pending}
        onClick={() => onChoose('disetujui')}>Setujui</button>
      <button className="secondary-button" type="button" disabled={pending}
        onClick={() => onChoose('ditolak')}>Tolak</button>
    </div>}
  </li>;
}

export default function EventModerationPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState({ loading: true });
  const [selection, setSelection] = useState(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const mutation = useRef(null);

  useEffect(() => { document.title = 'Moderasi event | EventKu'; }, []);
  useEffect(() => {
    const controller = new AbortController();
    listPendingEvents({ token, page, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil(result.total / MODERATION_PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
      else setView({ result });
    }).catch((error) => {
      if (!controller.signal.aborted) setView({ error });
    });
    return () => controller.abort();
  }, [token, page, reload]);
  useEffect(() => () => mutation.current?.abort(), [token]);

  function loadPage(nextPage) {
    setSelection(null);
    setView({ loading: true });
    if (nextPage === page) setReload((value) => value + 1);
    else setPage(nextPage);
  }

  async function submit(event, status, reason) {
    if (mutation.current) return;
    const controller = new AbortController();
    mutation.current = controller;
    setPending(true);
    setFeedback(null);
    try {
      await moderateEvent(event.eventId, { status, reason, token, signal: controller.signal });
      if (!controller.signal.aborted) {
        setFeedback({ message: `${event.title} berhasil ${status}.` });
        loadPage(page);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const changed = error.status === 409 || error.status === 404;
        const uncertain = !error.status || error.status >= 500;
        const message = changed ? 'Status pengajuan sudah berubah. Antrean dimuat ulang.'
          : uncertain ? 'Hasil moderasi belum dapat dipastikan. Antrean dimuat ulang untuk memeriksa status.'
            : error.message;
        setFeedback({ error: true, message });
        if (changed || uncertain) loadPage(page);
      }
    } finally {
      mutation.current = null;
      setPending(false);
    }
  }

  const { result, error, loading } = view;
  const pageCount = Math.ceil((result?.total ?? 0) / MODERATION_PAGE_SIZE);

  return <PageShell><section className="account-section moderation-page">
    <div className="account-heading">
      <div><h1>Moderasi event</h1><p>Tinjau pengajuan penyelenggara sebelum event tampil di katalog.</p></div>
      <div className="moderation-actions">
        <Link className="secondary-button" to="/admin/moderasi/tayang">Event tayang</Link>
        <Link className="secondary-button" to="/admin/moderasi/riwayat">Riwayat moderasi</Link>
        <Link className="secondary-button" to="/admin">Kembali ke ruang admin</Link>
      </div>
    </div>
    {feedback && <p className={`moderation-feedback${feedback.error ? ' moderation-error' : ''}`}
      role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
    {loading && <p role="status">Memuat antrean moderasi…</p>}
    {error && <div className="moderation-card">
      <p role="alert">{error.message}</p>
      <button className="secondary-button" type="button" onClick={() => loadPage(page)}>Coba lagi</button>
    </div>}
    {result && <>
      <div className="moderation-queue-header">
        <p>{result.total} pengajuan menunggu moderasi</p>
        <button className="secondary-button" type="button" disabled={pending} onClick={() => {
          setFeedback(null);
          loadPage(page);
        }}>Muat ulang</button>
      </div>
      {result.events.length ? <ul className="moderation-list">
        {result.events.map((event) => <ModerationCard key={event.eventId} event={event} pending={pending}
          decision={selection?.eventId === event.eventId ? selection.status : null}
          onChoose={(status) => {
            setFeedback(null);
            setSelection({ eventId: event.eventId, status });
          }}
          onCancel={() => setSelection(null)}
          onSubmit={(reason) => submit(event, selection.status, reason)} />)}
      </ul> : <p className="moderation-card">Belum ada pengajuan untuk ditinjau.</p>}
      {pageCount > 1 && <nav className="moderation-pagination" aria-label="Halaman antrean moderasi">
        <button className="secondary-button" type="button" disabled={pending || page <= 1}
          onClick={() => loadPage(page - 1)}>Sebelumnya</button>
        <span>Halaman {page} dari {pageCount}</span>
        <button className="secondary-button" type="button" disabled={pending || page >= pageCount}
          onClick={() => loadPage(page + 1)}>Berikutnya</button>
      </nav>}
    </>}
  </section></PageShell>;
}
