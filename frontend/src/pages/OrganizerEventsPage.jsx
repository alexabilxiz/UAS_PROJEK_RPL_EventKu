import { Link } from 'react-router-dom';
import WorkspacePage from '../components/WorkspacePage';
import { useWorkspaceList } from '../hooks/useWorkspaceList';
import { EVENT_STATUS_LABELS, workspaceService } from '../services/workspaceService';
import { formatEventDate, formatEventTime } from '../utils/events';

export default function OrganizerEventsPage() {
  const list = useWorkspaceList(workspaceService.organizerEvents);
  const events = list.result?.data ?? [];

  return <WorkspacePage title="Event organisasi" description="Lihat status event dan jumlah pendaftar aktif."
    backTo="/penyelenggara" backLabel="Kembali ke ruang penyelenggara" list={list}>
    {events.length ? <ul className="workspace-list">
      {events.map((event) => <li className="workspace-card workspace-row" key={event.eventId}>
        <div>
          <h2>{event.title}</h2>
          <p className="workspace-muted">{formatEventDate(event.startAt)} {formatEventTime(event.startAt)}</p>
          <p>{event.registrationMode === 'external' ? 'Pendaftaran melalui tautan panitia'
            : `${event.reservedSeats ?? '—'} peserta aktif`}</p>
        </div>
        <div className="workspace-actions">
          <span className="workspace-badge">{EVENT_STATUS_LABELS[event.status] ?? 'Status belum tersedia'}</span>
          {event.registrationMode !== 'external' && <Link className="secondary-button"
            to={`/penyelenggara/event/${event.eventId}/peserta`}>Lihat peserta</Link>}
          <Link className="secondary-button" to={`/penyelenggara/event/${event.eventId}/kelola`}>Kelola event</Link>
        </div>
      </li>)}
    </ul> : <p className="workspace-card">Organisasi Anda belum memiliki event.</p>}
  </WorkspacePage>;
}
