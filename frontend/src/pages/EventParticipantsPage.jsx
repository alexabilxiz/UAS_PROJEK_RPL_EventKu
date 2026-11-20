import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import WorkspacePage from '../components/WorkspacePage';
import { useWorkspaceList } from '../hooks/useWorkspaceList';
import { workspaceService } from '../services/workspaceService';
import { formatEventDate, formatEventTime, normalizeEventId } from '../utils/events';

function downloadCsv(csv, eventId) {
  const file = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `peserta-${eventId}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EventParticipants({ eventId }) {
  const readParticipants = useCallback((options) => workspaceService.participants(eventId, options), [eventId]);
  const list = useWorkspaceList(readParticipants);
  const { eventTitle, data = [], total } = list.result ?? {};

  return <WorkspacePage title="Daftar peserta" description={eventTitle}
    backTo="/penyelenggara/event" backLabel="Kembali ke event organisasi" list={list}>
    <div className="workspace-card workspace-stack">
      <div className="workspace-row">
        <h2>{total} peserta aktif</h2>
        <button className="primary-button" type="button" disabled={list.busy || !total} onClick={() => list.run(
          async (options) => {
            const csv = await workspaceService.exportParticipants(eventId, options);
            if (!options.signal.aborted) downloadCsv(csv, eventId);
          }, 'Unduhan CSV dimulai.', { refresh: false },
        )}>Unduh CSV</button>
      </div>
      {data.length ? <div className="workspace-table" role="region" aria-label="Daftar peserta" tabIndex={0}>
        <table>
          <thead><tr><th scope="col">Nama</th><th scope="col">Email</th><th scope="col">Waktu daftar</th></tr></thead>
          <tbody>{data.map((person) => <tr key={person.registrationId}>
            <td>{person.name}</td><td>{person.email}</td>
            <td>{formatEventDate(person.registeredAt)} · {formatEventTime(person.registeredAt)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p>Belum ada peserta aktif.</p>}
    </div>
  </WorkspacePage>;
}

export default function EventParticipantsPage() {
  const { eventId } = useParams();
  const id = normalizeEventId(eventId);
  return id ? <EventParticipants key={id} eventId={id} /> : <WorkspacePage title="Daftar peserta"
    backTo="/penyelenggara/event" backLabel="Kembali ke event organisasi"
    list={{ error: 'Alamat event tidak valid.' }} />;
}
