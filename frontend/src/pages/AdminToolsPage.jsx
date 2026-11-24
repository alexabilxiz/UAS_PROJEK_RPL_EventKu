import { useState } from 'react';
import WorkspacePage from '../components/WorkspacePage';
import { useWorkspaceList } from '../hooks/useWorkspaceList';
import { moderateEvent, REJECTION_REASON_LIMIT } from '../services/eventModerationService';
import { EVENT_STATUS_LABELS, workspaceService } from '../services/workspaceService';
import { ROLE_LABELS } from '../utils/auth';
import { formatEventDate, formatEventTime } from '../utils/events';

export function AdminUsersPage() {
  const list = useWorkspaceList(workspaceService.users);
  const [confirming, setConfirming] = useState(null);
  const users = list.result?.data ?? [];
  return <WorkspacePage title="Kelola pengguna" backTo="/admin" backLabel="Kembali ke ruang admin" list={list}>
    {users.length ? <ul className="workspace-list">
      {users.map((person) => {
        const active = person.status === 'active';
        const pending = person.status === 'pending';
        const selected = confirming === person.userId;
        return <li className="workspace-card workspace-row" key={person.userId}>
          <div><h2>{person.name}</h2><p className="workspace-muted">{person.email} · {ROLE_LABELS[person.role]}</p></div>
          <div className="workspace-actions">
            <span className="workspace-badge">{active ? 'Aktif' : pending ? 'Menunggu verifikasi' : 'Nonaktif'}</span>
            {person.role !== 'admin' && (selected ? <>
              <button type="button" className="primary-button" disabled={list.busy} onClick={async () => {
                if (await list.run((options) => workspaceService.updateUser(person.userId, active ? 'disabled' : 'active', options),
                  active ? 'Akun dinonaktifkan.' : pending ? 'Akun penyelenggara diverifikasi.' : 'Akun diaktifkan kembali.')) setConfirming(null);
              }}>{active ? 'Ya, nonaktifkan akun' : pending ? 'Ya, verifikasi akun' : 'Ya, aktifkan akun'}</button>
              <button type="button" className="secondary-button" disabled={list.busy} onClick={() => setConfirming(null)}>Batal</button>
            </> : <button type="button" className="secondary-button" disabled={list.busy}
              onClick={() => setConfirming(person.userId)}>{active ? 'Nonaktifkan akun' : pending ? 'Verifikasi akun' : 'Aktifkan kembali'}</button>)}
          </div>
        </li>;
      })}
    </ul> : <p className="workspace-card">Belum ada pengguna.</p>}
  </WorkspacePage>;
}

export function ModerationHistoryPage() {
  const list = useWorkspaceList(workspaceService.moderationHistory);
  const decisions = list.result?.data ?? [];
  return <WorkspacePage title="Riwayat moderasi" backTo="/admin/moderasi" backLabel="Kembali ke antrean" list={list}>
    {decisions.length ? <ul className="workspace-list">
      {decisions.map((row) => <li className="workspace-card workspace-stack" key={row.historyId}>
        <div className="workspace-row">
          <div><h2>{row.title}</h2><p className="workspace-muted">{row.adminName} · {formatEventDate(row.moderatedAt)} {formatEventTime(row.moderatedAt)}</p></div>
          <span className="workspace-badge">{row.status === 'dibatalkan' ? 'Diturunkan' : EVENT_STATUS_LABELS[row.status]}</span>
        </div>
        {row.reason && <p className="workspace-preserve">{row.reason}</p>}
      </li>)}
    </ul> : <p className="workspace-card">Belum ada riwayat keputusan moderasi.</p>}
  </WorkspacePage>;
}

function UnpublishForm({ event, list, onCancel }) {
  const [reason, setReason] = useState('');
  return <form className="workspace-stack" onSubmit={async (submission) => {
    submission.preventDefault();
    if (reason.trim() && await list.run((options) => moderateEvent(event.eventId,
      { ...options, status: 'dibatalkan', reason }), 'Event diturunkan dari katalog.')) onCancel();
  }}>
    <label className="workspace-field">Alasan penurunan
      <textarea rows={3} required maxLength={REJECTION_REASON_LIMIT} value={reason} disabled={list.busy}
        onChange={({ target }) => setReason(target.value)} />
    </label>
    <div className="workspace-actions">
      <button className="primary-button" disabled={list.busy || !reason.trim()}>Konfirmasi penurunan</button>
      <button className="secondary-button" type="button" disabled={list.busy} onClick={onCancel}>Batal</button>
    </div>
  </form>;
}

export function PublishedEventsPage() {
  const list = useWorkspaceList(workspaceService.publishedEvents);
  const [selected, setSelected] = useState(null);
  const events = list.result?.data ?? [];
  return <WorkspacePage title="Event tayang" description="Turunkan event yang melanggar ketentuan dari katalog publik."
    backTo="/admin/moderasi" backLabel="Kembali ke antrean" list={list}>
    {events.length ? <ul className="workspace-list">
      {events.map((event) => <li className="workspace-card workspace-stack" key={event.eventId}>
        <div className="workspace-row">
          <div><h2>{event.title}</h2><p className="workspace-muted">{event.organizationName} · {formatEventDate(event.startAt)}</p></div>
          {selected !== event.eventId && <button type="button" className="secondary-button" disabled={list.busy}
            onClick={() => setSelected(event.eventId)}>Turunkan event</button>}
        </div>
        {selected === event.eventId && <UnpublishForm event={event} list={list} onCancel={() => setSelected(null)} />}
      </li>)}
    </ul> : <p className="workspace-card">Belum ada event tayang.</p>}
  </WorkspacePage>;
}
