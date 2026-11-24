import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EventSubmissionFields from '../components/EventSubmissionFields';
import WorkspacePage from '../components/WorkspacePage';
import { useWorkspaceList } from '../hooks/useWorkspaceList';
import { listCategories } from '../services/eventService';
import { changeOrganizerEvent, getOrganizerEvent, submitEventDraft } from '../services/eventSubmissionService';
import { EVENT_STATUS_LABELS } from '../services/workspaceService';
import { prepareEventDraft } from '../utils/eventSubmission';
import { formatEventDate, formatEventTime, normalizeEventId } from '../utils/events';
import '../styles/event-submission.css';

const manageable = ['draft', 'menunggu_moderasi', 'disetujui', 'ditolak'];
const backTo = '/penyelenggara/event';
const toLocalTime = (date) => date ? new Date(Date.parse(date) + 25_200_000).toISOString().slice(0, 16) : '';

function EditEvent({ event, list, onClose }) {
  const [values, setValues] = useState(() => ({
    ...event, startAt: toLocalTime(event.startAt), endAt: toLocalTime(event.endAt),
    quota: event.quota?.toString() ?? '',
  }));
  const [errors, setErrors] = useState({});
  const [categoryResult, setCategoryResult] = useState({ loading: true, data: [] });
  const [attempt, setAttempt] = useState(0);
  const [posterBusy, setPosterBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    listCategories({ signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return;
      if (event.categoryId && !data.some(({ categoryId }) => categoryId === event.categoryId)) {
        data.push({ categoryId: event.categoryId, name: event.categoryName || event.categoryId });
      }
      setCategoryResult({ data });
    }).catch((error) => {
      if (!controller.signal.aborted) setCategoryResult({ error: error.message, data: [] });
    });
    return () => controller.abort();
  }, [attempt, event]);
  const field = (name) => ({
    id: name, value: values[name], error: errors[name], required: true,
    onChange({ target }) {
      setValues((prev) => ({ ...prev, [name]: target.value }));
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    },
  });

  async function save(submit) {
    submit.preventDefault();
    if (posterBusy) return;
    const { errors: validation, payload } = prepareEventDraft(values, categoryResult.data);
    setErrors(validation);
    if (!payload) return;
    for (const key of ['startAt', 'endAt']) {
      if (values[key] === toLocalTime(event[key])) payload[key] = event[key];
    }
    if (await list.run((options) => changeOrganizerEvent(event, 'update', payload, options), 'Perubahan event disimpan.')) onClose();
  }
  return <form className="submission-card workspace-stack" noValidate onSubmit={save}>
    <EventSubmissionFields busy={list.busy} field={field} values={values} organizationId={event.organizationId}
      onPosterBusy={setPosterBusy} onPosterUploaded={(value) => field('posterUrl').onChange({ target: { value } })}
      categoryResult={categoryResult} retryCategories={() => {
        setCategoryResult({ loading: true, data: [] });
        setAttempt((value) => value + 1);
      }} />
    {event.status === 'disetujui' && <p>Perubahan jadwal atau lokasi akan mengirim event kembali ke moderasi.</p>}
    <div className="workspace-actions">
      <button type="submit" className="primary-button" disabled={list.busy || posterBusy || !categoryResult.data.length}>Simpan perubahan event</button>
      <button type="button" className="secondary-button" disabled={list.busy} onClick={onClose}>Kembali</button>
    </div>
  </form>;
}

function ManageEvent({ eventId }) {
  const loadEvent = useCallback(async (options) => ({ event: await getOrganizerEvent(eventId, options), total: 1 }), [eventId]);
  const list = useWorkspaceList(loadEvent);
  const [mode, setMode] = useState('');
  const event = list.result?.event;
  const canChange = manageable.includes(event?.status);
  return <WorkspacePage title="Kelola event" description={event?.title} backTo={backTo}
    backLabel="Kembali ke event organisasi" list={list}>
    {event && (mode === 'edit' && canChange ? <EditEvent event={event} list={list} onClose={() => setMode('')} />
      : <section className="workspace-card workspace-stack">
        <div className="workspace-row"><h2>{event.title}</h2><span className="workspace-badge">{EVENT_STATUS_LABELS[event.status]}</span></div>
        <p>{formatEventDate(event.startAt)} {formatEventTime(event.startAt)} · {event.locationOrLink}</p>
        <p className="workspace-preserve">{event.description}</p>
        {canChange && mode === 'cancel' ? <>
          <p>Batalkan event ini? Peserta aktif akan menerima notifikasi.</p>
          <div className="workspace-actions">
            <button type="button" className="primary-button" disabled={list.busy} onClick={async () => {
              if (await list.run((options) => changeOrganizerEvent(event, 'cancel', undefined, options), 'Event dibatalkan.')) setMode('');
            }}>Ya, batalkan event</button>
            <button type="button" className="secondary-button" disabled={list.busy} onClick={() => setMode('')}>Kembali</button>
          </div>
        </> : <div className="workspace-actions">
          {canChange && Date.parse(event.startAt) > Date.now() && <button type="button" className="secondary-button" disabled={list.busy} onClick={() => setMode('edit')}>Edit event</button>}
          {event.status === 'draft' && <button type="button" className="primary-button" disabled={list.busy}
            onClick={() => list.run((options) => submitEventDraft(eventId, options), 'Event diajukan untuk moderasi.')}>Ajukan draft</button>}
          {canChange && <button type="button" className="secondary-button" disabled={list.busy} onClick={() => setMode('cancel')}>Batalkan event</button>}
          {event.status === 'disetujui' && <Link className="secondary-button" to={`/events/${eventId}`}>Lihat di katalog</Link>}
        </div>}
      </section>)}
  </WorkspacePage>;
}

export default function OrganizerManageEventPage() {
  const id = normalizeEventId(useParams().eventId);
  return id ? <ManageEvent key={id} eventId={id} /> : <WorkspacePage title="Kelola event" backTo={backTo}
    backLabel="Kembali ke event organisasi" list={{ error: 'Alamat event tidak valid.' }} />;
}
