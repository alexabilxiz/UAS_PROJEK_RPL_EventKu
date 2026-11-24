import WorkspacePage from '../components/WorkspacePage';
import { useWorkspaceList } from '../hooks/useWorkspaceList';
import { ORGANIZATION_LABELS, workspaceService } from '../services/workspaceService';

export default function AdminOrganizationsPage() {
  const list = useWorkspaceList(workspaceService.organizations);
  const organizations = list.result?.data ?? [];

  return <WorkspacePage title="Verifikasi organisasi" description="Periksa status organisasi sebelum memberi izin mengajukan event."
    backTo="/admin" backLabel="Kembali ke ruang admin" list={list}>
    {organizations.length ? <ul className="workspace-list">
      {organizations.map(({ organizationId, name, status }) => {
        const verified = status === 'verified';
        return <li className="workspace-card workspace-row" key={organizationId}>
          <div><h2>{name}</h2><p className="workspace-muted">{organizationId}</p></div>
          <div className="workspace-actions">
            <span className="workspace-badge">{ORGANIZATION_LABELS[status]}</span>
            <button className={verified ? 'secondary-button' : 'primary-button'} type="button" disabled={list.busy}
              onClick={() => list.run(
                (options) => workspaceService.updateOrganization(organizationId, verified ? 'suspended' : 'verified', options),
                `${name} ${verified ? 'ditangguhkan' : 'terverifikasi'}.`,
              )}>{verified ? 'Tangguhkan' : 'Verifikasi'}</button>
          </div>
        </li>;
      })}
    </ul> : <p className="workspace-card">Belum ada organisasi.</p>}
  </WorkspacePage>;
}
