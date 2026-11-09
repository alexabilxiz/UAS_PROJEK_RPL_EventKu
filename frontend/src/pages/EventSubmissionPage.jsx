import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../components/FormField';
import Icon from '../components/Icon';
import PageShell from '../components/PageShell';
import { useAuth } from '../hooks/useAuth';
import { listCategories } from '../services/eventService';
import { createEventDraft, getEventDraftStatus, submitEventDraft } from '../services/eventSubmissionService';
import { isHttpsPoster, prepareEventDraft } from '../utils/eventSubmission';
import { normalizeEventId } from '../utils/events';
import '../styles/event-submission.css';

const emptyForm = {
  title: '', description: '', categoryId: '', startAt: '', endAt: '',
  locationOrLink: '', quota: '', posterUrl: '',
};

const statusLabels = {
  menunggu_moderasi: 'Menunggu Moderasi', disetujui: 'Disetujui',
  ditolak: 'Ditolak', selesai: 'Selesai', dibatalkan: 'Dibatalkan',
};

function readAttempt(key) {
  try {
    const attempt = JSON.parse(sessionStorage.getItem(key));
    if (attempt?.kind === 'unconfirmed') return attempt;
    const eventId = normalizeEventId(attempt?.eventId);
    if (attempt?.kind === 'draft' && eventId) return { kind: 'draft', eventId };
  } catch { /* The current tab can still submit without sessionStorage. */ }
  return null;
}

function writeAttempt(key, attempt) {
  try {
    if (attempt) sessionStorage.setItem(key, JSON.stringify(attempt));
    else sessionStorage.removeItem(key);
  } catch { /* Keep the confirmed draft in component state when storage is unavailable. */ }
}

function messageFor(failure, hasDraft) {
  if (failure.status === 401) return 'Sesi Anda berakhir. Silakan masuk kembali untuk melanjutkan.';
  if (failure.status === 403) return 'Pengajuan memerlukan izin dari organisasi pemilik yang terverifikasi.';
  if (failure.status === 404 && hasDraft) return 'Draft tidak ditemukan atau sudah tidak dapat diakses.';
  if (failure.status === 409) return hasDraft
    ? 'Status draft berubah. Periksa status sebelum melanjutkan pengajuan.'
    : 'Draft belum dapat disimpan karena konflik data. Periksa kembali informasi event.';
  if (failure.status === 422) return hasDraft
    ? 'Server menolak pengajuan. Periksa kembali jadwal dan detail draft.'
    : 'Server menolak data event. Periksa kembali seluruh kolom.';
  return hasDraft ? 'Pengajuan belum terkonfirmasi. Lanjutkan dengan draft yang sudah tersimpan.' : failure.message;
}

function EventSubmissionForm({ user, token, logout, storageKey }) {
  const [values, setValues] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(() => readAttempt(storageKey));
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState('');
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [categoryResult, setCategoryResult] = useState({ loading: true, data: [], error: '' });
  const request = useRef(null);
  const alert = useRef(null);
  const showForm = !attempt && !receipt;

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    if (!showForm) return;
    const controller = new AbortController();
    setCategoryResult({ loading: true, data: [], error: '' });
    listCategories({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setCategoryResult({ loading: false, data, error: '' });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCategoryResult({ loading: false, data: [], error: 'Kategori belum dapat dimuat.' });
        }
      });
    return () => controller.abort();
  }, [showForm, categoryRetry]);

  useEffect(() => { if (failure) alert.current?.focus(); }, [failure]);

  const change = (name) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setFailure(null);
  };

  function remember(next) {
    writeAttempt(storageKey, next);
    setAttempt(next);
  }

  function finish(eventId, status) {
    remember(null);
    setReceipt({ eventId, status });
  }

  async function submit(event, saveOnly = false) {
    event.preventDefault();
    if (request.current || receipt || attempt?.kind === 'unconfirmed') return;
    let draft = attempt;
    let payload;
    if (!draft) {
      const prepared = prepareEventDraft(values, categoryResult.data);
      setErrors(prepared.errors);
      if (!prepared.payload) {
        document.getElementById(Object.keys(prepared.errors)[0])?.focus();
        return;
      }
      payload = prepared.payload;
    }

    const controller = new AbortController();
    const options = { token, signal: controller.signal };
    request.current = controller;
    setFailure(null);
    const createAction = saveOnly ? 'save-only' : 'save';
    setBusy(draft ? 'submit' : createAction);
    try {
      if (!draft) {
        // Preserve uncertainty on navigation or timeout before the API confirms an ID.
        writeAttempt(storageKey, { kind: 'unconfirmed' });
        const eventId = await createEventDraft(payload, options);
        draft = { kind: 'draft', eventId };
        remember(draft);
        if (controller.signal.aborted || saveOnly) return;
        setBusy('submit');
      }
      const status = await submitEventDraft(draft.eventId, options);
      if (!controller.signal.aborted) finish(draft.eventId, status);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!draft) {
        // A lost response may mean the draft was saved. Avoid a second POST.
        const rejected = error.status >= 400 && error.status < 500 && error.status !== 408;
        remember(rejected ? null : { kind: 'unconfirmed' });
        if (!rejected) return;
      } else if (error.status === 409) {
        const status = await getEventDraftStatus(draft.eventId, options).catch(() => null);
        if (controller.signal.aborted) return;
        if (status && status !== 'draft') {
          finish(draft.eventId, status);
          return;
        }
      }
      setFailure({ status: error.status, message: messageFor(error, Boolean(draft)) });
      if (!draft && error.status === 422) setErrors(error.fieldErrors ?? {});
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy('');
    }
  }

  function startAnotherEvent() {
    if (request.current) return;
    const confirmed = window.confirm(
      `Draft ${attempt.eventId} tetap tersimpan di server. Buka formulir baru dan lepas pelacakan draft ini dari tab?`,
    );
    if (!confirmed) return;
    setValues(emptyForm);
    setErrors({});
    setFailure(null);
    remember(null);
  }

  const field = (name) => ({ id: name, value: values[name], onChange: change(name), error: errors[name], required: true });
  const formDisabled = Boolean(busy) || categoryResult.loading || categoryResult.data.length === 0;

  return <div className="submission-body">
    {failure && <div className="error-message" role="alert" ref={alert} tabIndex={-1}>
      <p>{failure.message}</p>
      {failure.status === 401 && <button className="text-button" type="button" onClick={logout}>Masuk kembali</button>}
    </div>}

    {receipt ? <section className="submission-card submission-result" role="status">
      <span className="feature-icon"><Icon name={['ditolak', 'dibatalkan'].includes(receipt.status) ? 'alert' : 'check'} size={24} /></span>
      <h2>{statusLabels[receipt.status]}</h2>
      <p>Event <strong>{receipt.eventId}</strong> tercatat dengan status tersebut.</p>
      {receipt.status === 'menunggu_moderasi' && <p>Tim admin akan meninjau pengajuan sebelum event tampil di katalog publik.</p>}
      <div className="submission-actions">
        <Link className="secondary-button" to="/penyelenggara">Kembali ke akun</Link>
        <button className="primary-button" type="button" onClick={() => { setReceipt(null); setValues(emptyForm); }}>Ajukan event lain</button>
      </div>
    </section> : attempt?.kind === 'unconfirmed' ? <section className="submission-card submission-result" aria-labelledby="draft-unconfirmed">
      <span className="feature-icon"><Icon name="alert" size={24} /></span>
      <h2 id="draft-unconfirmed">Penyimpanan draft belum terkonfirmasi</h2>
      <p>Periksa draft organisasi melalui pengelola EventKu. Lanjutkan ke formulir setelah memastikan draft ini belum tersimpan agar pengajuan tidak ganda.</p>
      <div className="submission-actions">
        <Link className="secondary-button" to="/penyelenggara">Kembali ke akun</Link>
        <button className="primary-button" type="button" onClick={() => remember(null)}>Saya sudah memeriksa draft</button>
      </div>
    </section> : attempt?.kind === 'draft' ? <form className="submission-card submission-result" onSubmit={submit} aria-busy={Boolean(busy)}>
      <span className="feature-icon"><Icon name="check" size={24} /></span>
      <h2>Draft tersimpan</h2>
      <p>ID draft <strong>{attempt.eventId}</strong>. Lanjutkan pengajuan untuk mengirim draft ini ke moderator.</p>
      <div className="submission-actions">
        <Link className="secondary-button" to="/penyelenggara">Kembali ke akun</Link>
        <button className="secondary-button" type="button" onClick={startAnotherEvent} disabled={Boolean(busy)}>Buat event lain</button>
        <button className="primary-button" type="submit" disabled={Boolean(busy)}>
          {busy ? <><span className="spinner" aria-hidden="true" />Mengirim pengajuan…</> : 'Lanjutkan pengajuan'}
        </button>
      </div>
    </form> : <form className="submission-card" noValidate onSubmit={submit} aria-busy={Boolean(busy)}>
      <div className="submission-grid">
        <fieldset disabled={Boolean(busy)} className="submission-info">
          <legend>Informasi event</legend>
          <FormField {...field('title')} label="Judul event" placeholder="Masukkan judul event" />
          <FormField {...field('description')} label="Deskripsi">
            <textarea rows={4} placeholder="Ceritakan tujuan dan kegiatan yang akan berlangsung." />
          </FormField>
          <div className="submission-fields">
            <FormField {...field('categoryId')} label="Kategori">
              <select disabled={categoryResult.loading || !categoryResult.data.length}>
                <option value="">{categoryResult.loading ? 'Memuat kategori…' : 'Pilih kategori'}</option>
                {categoryResult.data.map(({ categoryId, name }) => <option key={categoryId} value={categoryId}>{name}</option>)}
              </select>
            </FormField>
            <FormField id="submission-organization" label="ID organisasi" value={user.organizationId} readOnly />
          </div>
          {categoryResult.error && <p role="status" className="submission-category-message">{categoryResult.error} <button type="button" onClick={() => setCategoryRetry((count) => count + 1)}>Muat ulang</button></p>}
          {!categoryResult.loading && !categoryResult.error && categoryResult.data.length === 0 && <p className="submission-category-message" role="status">Belum ada kategori aktif.</p>}
          <div className="submission-fields">
            <FormField {...field('startAt')} label="Mulai (WIB)" type="datetime-local" />
            <FormField {...field('endAt')} label="Selesai (WIB)" type="datetime-local" />
            <FormField {...field('locationOrLink')} label="Lokasi atau tautan" placeholder="Aula kampus atau tautan pertemuan" />
            <FormField {...field('quota')} label="Kuota peserta" type="number" min={1} step={1} placeholder="Contoh 80" />
          </div>
        </fieldset>

        <fieldset disabled={Boolean(busy)} className="submission-poster">
          <legend>Poster event</legend>
          <div className="submission-poster-box">
            <span className="feature-icon"><Icon name="calendar" size={24} /></span>
            <p>Tambahkan tautan ke poster kegiatan.</p>
            <FormField {...field('posterUrl')} label="URL poster" type="url" placeholder="https://…" hint="Gunakan URL HTTPS yang dapat dibuka peserta." />
            {isHttpsPoster(values.posterUrl.trim()) && <a href={values.posterUrl.trim()} target="_blank" rel="noreferrer">Periksa tautan poster</a>}
          </div>
          <div className="submission-tip"><strong>Tips pengajuan</strong><p>Periksa jam mulai, jam selesai, dan kapasitas. Detail yang lengkap memudahkan admin meninjau event.</p></div>
        </fieldset>
      </div>
      <div className="submission-footer">
        <p>Event masuk ke antrean moderasi setelah pengajuan berhasil.</p>
        <div className="submission-actions">
          <Link className="secondary-button" to="/penyelenggara">Batal</Link>
          <button className="secondary-button" type="button" onClick={(event) => submit(event, true)} disabled={formDisabled}>
            {busy === 'save-only' ? <><span className="spinner" aria-hidden="true" />Menyimpan draft…</> : 'Simpan draft'}
          </button>
          <button className="primary-button" type="submit" disabled={formDisabled}>
            {busy === 'save' ? <><span className="spinner" aria-hidden="true" />Menyimpan draft…</> : 'Ajukan event'}
          </button>
        </div>
      </div>
    </form>}
  </div>;
}

export default function EventSubmissionPage() {
  const { user, token, logout } = useAuth();
  const canSubmit = Boolean(token && user?.role === 'penyelenggara' && user.organizationId && user.organizationStatus === 'verified');
  const storageKey = canSubmit ? `eventku.event-submission.${JSON.stringify([user.userId, user.organizationId])}` : null;

  useEffect(() => { document.title = 'Ajukan event | EventKu'; }, []);

  return <PageShell><div className="submission-page">
    <header className="submission-banner">
      <div className="submission-banner-inner">
        <div><p className="eyebrow">RUANG PENYELENGGARA</p><h1>Ajukan event</h1><p>Lengkapi informasi kegiatan kampus untuk diajukan ke admin.</p></div>
        <Link to="/penyelenggara"><Icon name="arrow-left" size={17} />Kembali ke akun</Link>
      </div>
    </header>
    {canSubmit ? <EventSubmissionForm key={storageKey} storageKey={storageKey} user={user} token={token} logout={logout} /> :
      <div className="submission-body"><section className="submission-card submission-result">
        <span className="feature-icon"><Icon name="shield" size={24} /></span>
        <h2>Organisasi perlu diverifikasi</h2>
        <p>Pengajuan event tersedia bagi penyelenggara setelah admin memverifikasi organisasinya.</p>
        <Link className="secondary-button" to="/penyelenggara">Lihat akun penyelenggara</Link>
      </section></div>}
  </div></PageShell>;
}
