import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EventPoster from '../components/EventPoster';
import FormField from '../components/FormField';
import Icon from '../components/Icon';
import PageShell from '../components/PageShell';
import { listCategories, listEvents } from '../services/eventService';
import { formatEventDate, formatEventTime, isEventDate, safeEventLink } from '../utils/events';
import '../styles/event-catalog.css';

const PAGE_SIZE = 9;

function readFilters(params) {
  const page = Number(params.get('page'));
  const date = params.get('date');
  return {
    q: params.get('q')?.trim() || '',
    category: params.get('category')?.trim() || '',
    organizer: params.get('organizer')?.trim() || '',
    date: isEventDate(date) ? date : '',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

function filterParams({ q, category, organizer, date, page = 1 }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ q, category, organizer, date })) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set('page', String(page));
  return params;
}

function CatalogFilters({ values, categories, onApply }) {
  const [draft, setDraft] = useState(values);
  const update = (field) => (event) => {
    setDraft((previous) => ({ ...previous, [field]: event.target.value }));
  };
  const chosenCategory = draft.category && !categories.some(({ categoryId }) => categoryId === draft.category);

  function submit(event) {
    event.preventDefault();
    onApply({ ...draft, q: draft.q.trim(), organizer: draft.organizer.trim(), page: 1 });
  }

  return (
    <form className="catalog-filters" onSubmit={submit} aria-label="Pencarian event">
      <FormField id="event-search" label="Cari event" type="search" placeholder="Judul atau topik event" value={draft.q} onChange={update('q')} />
      <FormField id="event-category" label="Kategori">
        <select value={draft.category} onChange={update('category')}>
          <option value="">Semua kategori</option>
          {chosenCategory && <option value={draft.category}>Kategori {draft.category}</option>}
          {categories.map(({ categoryId, name }) => <option key={categoryId} value={categoryId}>{name}</option>)}
        </select>
      </FormField>
      <FormField id="event-organizer" label="ID penyelenggara" placeholder="Semua penyelenggara" value={draft.organizer} onChange={update('organizer')} />
      <FormField id="event-date" label="Tanggal event" type="date" value={draft.date} onChange={update('date')} />
      <button className="primary-button" type="submit">Cari Event</button>
    </form>
  );
}

function EventCard({ event, search }) {
  const time = formatEventTime(event.startAt);
  const link = safeEventLink(event.locationOrLink);
  return (
    <article className="event-card">
      <EventPoster event={event} />
      <div className="event-card-body">
        <h3>{event.title}</h3>
        <p><Icon name="calendar" size={16} /><span>{formatEventDate(event.startAt)}{time && ` · ${time}`}</span></p>
        <p><Icon name="location" size={16} /><span>{link ? 'Event daring' : event.locationOrLink || 'Lokasi belum tersedia'}</span></p>
        <Link className="secondary-button" to={`/events/${encodeURIComponent(event.eventId)}`} state={{ catalogSearch: search }}>
          Lihat detail <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </article>
  );
}

function CatalogResults({ filters, search, onPage, onReset }) {
  const [result, setResult] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const { q, category, organizer, date, page } = filters;

  useEffect(() => {
    const controller = new AbortController();
    listEvents({ q, category, organizer, date, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted) setResult({ status: 'ready', payload });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ status: 'error', message: error.message });
      });
    return () => controller.abort();
  }, [q, category, organizer, date, page, attempt]);

  const payload = result.payload;
  const pages = payload ? Math.max(1, Math.ceil(payload.total / PAGE_SIZE)) : 1;
  const hasFilters = Boolean(q || category || organizer || date);
  return (
    <section className="catalog-results" aria-labelledby="event-results-title" aria-busy={result.status === 'loading'}>
      <div className="catalog-results-heading">
        <div>
          <h2 id="event-results-title">{hasFilters ? 'Hasil pencarian' : 'Event kampus'}</h2>
          <p>{payload ? `${payload.total} event tersedia` : 'Temukan kegiatan dari komunitas kampus.'}</p>
        </div>
        {hasFilters && <button className="text-button" type="button" onClick={onReset}>Hapus filter</button>}
      </div>
      {result.status === 'loading' && <div className="event-feedback" role="status"><span className="spinner" />Memuat event…</div>}
      {result.status === 'error' && (
        <div className="event-feedback">
          <p role="alert">{result.message || 'Daftar event gagal dimuat.'}</p>
          <button className="secondary-button" type="button" onClick={() => { setResult({ status: 'loading' }); setAttempt((value) => value + 1); }}>Coba lagi</button>
        </div>
      )}
      {payload && (payload.data.length ? (
        <div className="event-grid">{payload.data.map((event) => <EventCard key={event.eventId} event={event} search={search} />)}</div>
      ) : (
        <div className="event-feedback" role="status">
          <Icon name="calendar" size={30} />
          <h3>{hasFilters ? 'Event tidak ditemukan' : 'Belum ada event di halaman ini'}</h3>
          <p>{hasFilters ? 'Coba kata kunci atau filter lain.' : 'Kegiatan yang sudah disetujui akan muncul di sini.'}</p>
        </div>
      ))}
      {payload && (pages > 1 || payload.page > 1) && (
        <nav className="catalog-pagination" aria-label="Halaman katalog">
          <button className="secondary-button" type="button" disabled={payload.page <= 1} onClick={() => onPage(Math.min(payload.page - 1, pages))}>Sebelumnya</button>
          <span>Halaman {payload.page} dari {pages}</span>
          <button className="secondary-button" type="button" disabled={payload.page >= pages} onClick={() => onPage(payload.page + 1)}>Berikutnya</button>
        </nav>
      )}
    </section>
  );
}

export default function EventCatalogPage() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState(false);
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const filters = readFilters(params);
  const search = filterParams(filters).toString();

  useEffect(() => { document.title = 'Event UKWMS | EventKu'; }, []);
  useEffect(() => {
    const controller = new AbortController();
    listCategories({ signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setCategories(data); })
      .catch(() => { if (!controller.signal.aborted) setCategoryError(true); });
    return () => controller.abort();
  }, [categoryAttempt]);

  function apply(next) {
    setParams(filterParams(next));
  }

  return (
    <PageShell>
      <section className="catalog-hero">
        <div className="event-width">
          <p className="eyebrow">AGENDA KAMPUS</p>
          <h1>Event UKWMS</h1>
          <p>Jelajahi kegiatan, tambah pengalaman, dan perluas relasimu di kampus.</p>
          <CatalogFilters key={filterParams({ ...filters, page: 1 }).toString()} values={filters} categories={categories} onApply={apply} />
          {categoryError && <div className="catalog-category-error"><span role="status">Kategori gagal dimuat. Pencarian tetap tersedia.</span><button type="button" className="text-button" onClick={() => { setCategoryError(false); setCategoryAttempt((value) => value + 1); }}>Muat ulang kategori</button></div>}
        </div>
      </section>
      <div className="catalog-background">
        <CatalogResults key={search} filters={filters} search={search} onPage={(page) => apply({ ...filters, page })} onReset={() => setParams({})} />
      </div>
    </PageShell>
  );
}
