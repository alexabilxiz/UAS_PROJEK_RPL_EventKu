import WorkspacePage from '../components/WorkspacePage';
import { useWorkspaceList } from '../hooks/useWorkspaceList';
import { workspaceService } from '../services/workspaceService';
import { monthLabel } from '../utils/calendar';
import { formatEventDate, isEventDate } from '../utils/events';

const loadAdmin = async (options) => ({ total: 1, ...await workspaceService.statistics('admin', options) });
const loadOrganizer = async (options) => ({ total: 1, ...await workspaceService.statistics('penyelenggara', options) });
const formatDay = (date) => isEventDate(date) ? formatEventDate(`${date}T00:00:00+07:00`) : date;
const idNumber = new Intl.NumberFormat('id-ID');

function CountChart({ title, rows, format = (value) => value }) {
  const max = Math.max(1, ...rows.map(({ total }) => total));
  return <section className="workspace-card workspace-stack">
    <h2>{title}</h2>
    {rows.length ? <ul className="workspace-stack">{rows.map(({ label, total }) => <li key={label}>
      <div className="workspace-row"><span>{format(label)}</span><strong>{idNumber.format(total)}</strong></div>
      <progress aria-label={format(label)} max={max} value={total} />
    </li>)}</ul> : <p>Belum ada data.</p>}
  </section>;
}

export default function WorkspaceStatisticsPage({ admin = false }) {
  const list = useWorkspaceList(admin ? loadAdmin : loadOrganizer);
  const stats = list.result;
  const metrics = admin ? [['Pengguna', stats?.users], ['Event', stats?.events], ['Pendaftaran aktif', stats?.registrations]]
    : [['Pendaftar aktif', stats?.active], ['Kuota terisi', `${stats?.occupancy ?? 0}%`]];
  return <WorkspacePage title={admin ? 'Statistik platform' : 'Statistik organisasi'}
    backTo={admin ? '/admin' : '/penyelenggara'} backLabel={admin ? 'Kembali ke ruang admin' : 'Kembali ke ruang penyelenggara'} list={list}>
    {stats && <div className="workspace-list workspace-statistics">
      <dl className="workspace-stat-grid">
        {metrics.map(([label, value]) => <div key={label} className="workspace-card">
          <dt>{label}</dt><dd>{typeof value === 'number' ? idNumber.format(value) : value}</dd>
        </div>)}
      </dl>
      {admin ? <>
        <CountChart title="Event per kategori" rows={stats.categories} />
        <CountChart title="Event per bulan (WIB)" rows={stats.months} format={monthLabel} />
      </> : <CountChart title="Tren pendaftaran aktif (WIB)" rows={stats.trend} format={formatDay} />}
    </div>}
  </WorkspacePage>;
}
