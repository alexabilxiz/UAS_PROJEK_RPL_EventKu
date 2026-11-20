import { Link } from 'react-router-dom';
import WorkspacePage from '../components/WorkspacePage';
import { useWorkspaceList } from '../hooks/useWorkspaceList';
import { EVENT_STATUS_LABELS, workspaceService } from '../services/workspaceService';
import { formatEventDate, formatEventTime } from '../utils/events';

export default function OrganizerNotificationsPage() {
  const list = useWorkspaceList(workspaceService.notifications);
  const notifications = list.result?.data ?? [];

  return <WorkspacePage title="Notifikasi penyelenggara" description="Lihat hasil moderasi event organisasi Anda."
    backTo="/penyelenggara" backLabel="Kembali ke ruang penyelenggara" list={list}>
    {notifications.length ? <ul className="workspace-list">
      {notifications.map((notice) => <li className="workspace-card workspace-stack" key={notice.notificationId}>
        <div className="workspace-row">
          <div>
            <h2>{notice.title}</h2>
            <p className="workspace-muted">{formatEventDate(notice.createdAt)} · {formatEventTime(notice.createdAt)}</p>
          </div>
          <span className="workspace-badge">{notice.isRead ? 'Sudah dibaca' : 'Belum dibaca'}</span>
        </div>
        <p>Hasil moderasi <strong>{EVENT_STATUS_LABELS[notice.status]}</strong></p>
        {notice.reason && <div><strong>{notice.status === 'ditolak' ? 'Alasan penolakan' : 'Alasan penurunan event'}</strong><p className="workspace-preserve">{notice.reason}</p></div>}
        <div className="workspace-actions">
          {notice.status === 'disetujui' && <Link className="secondary-button" to={`/events/${notice.eventId}`}>Lihat event</Link>}
          {!notice.isRead && <button className="secondary-button" type="button" disabled={list.busy}
            onClick={() => list.run((options) => workspaceService.markRead(notice.notificationId, options), 'Notifikasi ditandai sudah dibaca.')}>
            Tandai sudah dibaca
          </button>}
        </div>
      </li>)}
    </ul> : <p className="workspace-card">Belum ada notifikasi hasil moderasi.</p>}
  </WorkspacePage>;
}
