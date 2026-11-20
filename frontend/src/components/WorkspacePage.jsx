import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageShell from './PageShell';
import { WORKSPACE_PAGE_SIZE } from '../services/workspaceService';
import '../styles/workspace.css';

export default function WorkspacePage({ title, description, backTo, backLabel, list, children }) {
  useEffect(() => { document.title = `${title} | EventKu`; }, [title]);
  const { result, loading, error, feedback, busy, page, load } = list;
  const pages = Math.ceil((result?.total ?? 0) / WORKSPACE_PAGE_SIZE);

  return <PageShell><section className="account-section workspace-page">
    <div className="account-heading">
      <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      <Link className="secondary-button" to={backTo}>{backLabel}</Link>
    </div>
    {feedback && <p className={`workspace-feedback${feedback.error ? ' workspace-error' : ''}`}
      role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
    {loading && <p role="status">Memuat data…</p>}
    {error && <div className="workspace-card workspace-stack">
      <p role="alert">{error}</p>
      {load && <button className="secondary-button" type="button" onClick={() => load()}>Coba lagi</button>}
    </div>}
    {result && <>
      <div className="workspace-toolbar">
        <button className="secondary-button" type="button" disabled={busy} onClick={() => load()}>Muat ulang</button>
      </div>
      {children}
      {pages > 1 && <nav className="workspace-pagination" aria-label="Navigasi halaman">
        <button className="secondary-button" type="button" disabled={busy || page === 1}
          onClick={() => load(page - 1)}>Sebelumnya</button>
        <span>Halaman {page} dari {pages}</span>
        <button className="secondary-button" type="button" disabled={busy || page === pages}
          onClick={() => load(page + 1)}>Berikutnya</button>
      </nav>}
    </>}
  </section></PageShell>;
}
