import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import WorkspacePage from '../components/WorkspacePage';
import { useWorkspaceList } from '../hooks/useWorkspaceList';
import { listCategories } from '../services/eventService';
import { STUDENT_NOTICE_LABELS, workspaceService } from '../services/workspaceService';
import { formatEventDate, formatEventTime, normalizeEventId } from '../utils/events';

async function loadPreferences(options) {
  const [categories, interests, email] = await Promise.all([
    listCategories(options), workspaceService.interests(options), workspaceService.emailPreference(options),
  ]);
  return { total: 1, categories, interests, email };
}

function PreferenceForms({ result, list }) {
  const [choices, setChoices] = useState(result.interests);
  const [email, setEmail] = useState(result.email);
  return <>
    <form className="workspace-card workspace-stack" onSubmit={(event) => {
      event.preventDefault();
      list.run((options) => workspaceService.interests(options, choices), 'Kategori minat disimpan.', { refresh: false });
    }}>
      <h2>Kategori minat</h2>
      {result.categories.length ? result.categories.map(({ categoryId, name }) => <label key={categoryId} className="workspace-checkbox">
        <input type="checkbox" disabled={list.busy} checked={choices.includes(categoryId)}
          onChange={({ target }) => setChoices((current) => target.checked
            ? [...current, categoryId] : current.filter((id) => id !== categoryId))} />{name}
      </label>) : <p>Belum ada kategori aktif.</p>}
      <div className="workspace-actions"><button className="primary-button" disabled={list.busy}>Simpan minat</button></div>
    </form>
    <form className="workspace-card workspace-stack workspace-section" onSubmit={(event) => {
      event.preventDefault();
      list.run((options) => workspaceService.emailPreference(options, email), 'Preferensi email disimpan.', { refresh: false });
    }}>
      <h2>Notifikasi email</h2>
      <label className="workspace-checkbox"><input type="checkbox" disabled={list.busy}
        checked={email} onChange={({ target }) => setEmail(target.checked)} />Terima salinan notifikasi melalui email</label>
      <div className="workspace-actions"><button className="primary-button" disabled={list.busy}>Simpan preferensi email</button></div>
    </form>
  </>;
}

export function StudentPreferencesPage() {
  const list = useWorkspaceList(loadPreferences);
  return <WorkspacePage title="Minat dan pemberitahuan" backTo="/mahasiswa" backLabel="Kembali ke ruang mahasiswa" list={list}>
    {list.result && <PreferenceForms result={list.result} list={list} />}
  </WorkspacePage>;
}

export function StudentNotificationsPage() {
  const list = useWorkspaceList(workspaceService.studentNotices);
  const notices = list.result?.data ?? [];
  return <WorkspacePage title="Notifikasi mahasiswa" backTo="/mahasiswa" backLabel="Kembali ke ruang mahasiswa" list={list}>
    {import.meta.env.DEV && import.meta.env.MODE === 'demo' && list.result && <div className="workspace-actions workspace-section">
      <Link className="secondary-button" to="/mahasiswa/email-demo">Lihat kotak email demo</Link>
    </div>}
    {notices.length ? <ul className="workspace-list workspace-section">
      {notices.map((notice) => <li className="workspace-card workspace-stack" key={notice.notificationId}>
        <div className="workspace-row">
          <div><h2>{STUDENT_NOTICE_LABELS[notice.type]}</h2><p>{notice.title}</p>
            <p className="workspace-muted">{formatEventDate(notice.createdAt)} · {formatEventTime(notice.createdAt)}</p>
          </div>
          <span className="workspace-badge">{notice.isRead ? 'Sudah dibaca' : 'Belum dibaca'}</span>
        </div>
        <div className="workspace-actions">
          {['event_baru', 'rsvp', 'pengingat'].includes(notice.type) && <Link className="secondary-button" to={`/events/${notice.eventId}`}>Lihat event</Link>}
          {!notice.isRead && <button type="button" className="secondary-button" disabled={list.busy}
            onClick={() => list.run((options) => workspaceService.markStudentNotice(notice.notificationId, options), 'Notifikasi ditandai sudah dibaca.')}>
            Tandai sudah dibaca
          </button>}
        </div>
      </li>)}
    </ul> : <p className="workspace-card">Belum ada notifikasi.</p>}
  </WorkspacePage>;
}

export function StudentDemoMailPage() {
  const list = useWorkspaceList(workspaceService.demoEmail);
  const messages = list.result?.data ?? [];
  return <WorkspacePage title="Kotak email demo" description="Simulasi salinan email ketika preferensi email diaktifkan."
    backTo="/mahasiswa/notifikasi" backLabel="Kembali ke notifikasi mahasiswa" list={list}>
    {messages.length ? <ul className="workspace-list">
      {messages.map((message) => <li key={message.notificationId} className="workspace-card workspace-stack">
        <div><h2>{STUDENT_NOTICE_LABELS[message.type]}</h2>
          <p className="workspace-muted">Kepada {message.to} · {formatEventDate(message.createdAt)} {formatEventTime(message.createdAt)}</p>
        </div>
        <p>{message.title}</p>
      </li>)}
    </ul> : <p className="workspace-card">Belum ada salinan email demo.</p>}
  </WorkspacePage>;
}

export function StudentFavoritesPage() {
  const list = useWorkspaceList(workspaceService.favorites);
  const events = list.result?.data ?? [];
  return <WorkspacePage title="Event favorit" backTo="/mahasiswa" backLabel="Kembali ke ruang mahasiswa" list={list}>
    {events.length ? <ul className="workspace-list">
      {events.map((event) => <li className="workspace-card workspace-row" key={event.eventId}>
        <div><h2>{event.title}</h2><p className="workspace-muted">{formatEventDate(event.startAt)} {formatEventTime(event.startAt)}</p></div>
        <div className="workspace-actions">
          {event.status === 'disetujui' && <Link className="secondary-button" to={`/events/${event.eventId}`}>Lihat detail</Link>}
          <button className="secondary-button" type="button" disabled={list.busy}
            onClick={() => list.run((options) => workspaceService.favorite(event.eventId, options, false), 'Event dihapus dari favorit.')}>Hapus dari favorit</button>
        </div>
      </li>)}
    </ul> : <p className="workspace-card">Belum ada event favorit.</p>}
  </WorkspacePage>;
}

function ReviewForm({ initial, list, eventId }) {
  const [rating, setRating] = useState(initial?.rating?.toString() ?? '');
  const [comment, setComment] = useState(initial?.comment ?? '');
  return <form className="workspace-card workspace-stack" onSubmit={(event) => {
    event.preventDefault();
    list.run((options) => workspaceService.review(eventId, options, { rating: Number(rating), comment }), 'Ulasan disimpan.', { refresh: false });
  }}>
    <label className="workspace-field">Rating
      <select required value={rating} disabled={list.busy} onChange={({ target }) => setRating(target.value)}>
        <option value="">Pilih rating</option>
        {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} dari 5</option>)}
      </select>
    </label>
    <label className="workspace-field">Ulasan
      <textarea rows={4} required maxLength={1000} value={comment} disabled={list.busy} onChange={({ target }) => setComment(target.value)} />
    </label>
    <div className="workspace-actions"><button className="primary-button" disabled={list.busy || !rating || !comment.trim()}>Simpan ulasan</button></div>
  </form>;
}

function StudentReview({ eventId }) {
  const loadReview = useCallback(async (options) => ({ total: 1, ...await workspaceService.review(eventId, options) }), [eventId]);
  const list = useWorkspaceList(loadReview);
  return <WorkspacePage title="Beri ulasan event" description={list.result?.title} backTo="/mahasiswa/pendaftaran"
    backLabel="Kembali ke pendaftaran" list={list}>
    {list.result && <ReviewForm initial={list.result.review} list={list} eventId={eventId} />}
  </WorkspacePage>;
}

export function StudentReviewPage() {
  const id = normalizeEventId(useParams().eventId);
  return id ? <StudentReview key={id} eventId={id} /> : <WorkspacePage title="Beri ulasan event"
    backTo="/mahasiswa/pendaftaran" backLabel="Kembali ke pendaftaran" list={{ error: 'Alamat event tidak valid.' }} />;
}
