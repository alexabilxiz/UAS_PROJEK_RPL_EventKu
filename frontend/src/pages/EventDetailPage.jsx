import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import EventPoster from '../components/EventPoster';
import Icon from '../components/Icon';
import PageShell from '../components/PageShell';
import { getEvent } from '../services/eventService';
import { formatEventDate, formatEventTime, safeEventLink } from '../utils/events';
import '../styles/event-catalog.css';

function EventMetadata({ event }) {
  const startDate = formatEventDate(event.startAt);
  const endDate = event.endAt ? formatEventDate(event.endAt) : '';
  const startTime = formatEventTime(event.startAt);
  const endTime = formatEventTime(event.endAt);
  const locationLink = safeEventLink(event.locationOrLink);
  const dateRange = endDate && endDate !== startDate ? `${startDate} – ${endDate}` : startDate;
  const timeRange = [startTime, endTime].filter(Boolean).join(' – ');
  const items = [
    ['calendar', 'Tanggal', dateRange],
    ['clock', 'Waktu', timeRange || 'Belum tersedia'],
    ['location', 'Lokasi', locationLink ? <a href={locationLink} target="_blank" rel="noreferrer">Buka tautan event</a> : event.locationOrLink || 'Belum tersedia'],
    ['user', 'Penyelenggara', event.organizationName || 'Belum tersedia'],
  ];
  if (event.registrationMode === 'internal') {
    items.push(['user', 'Peserta yang boleh ikut', 'Mahasiswa UKWMS terverifikasi']);
    if (event.audience) items.push(['user', 'Ketentuan tambahan', event.audience]);
  } else if (event.audience) {
    items.push(['user', 'Peserta yang boleh ikut', event.audience]);
  }

  return <dl className="event-metadata">{items.map(([icon, label, value]) => (
    <div key={label}>
      <dt><span className="event-metadata-icon"><Icon name={icon} size={17} /></span>{label}</dt>
      <dd>{value}</dd>
    </div>
  ))}</dl>;
}

function EventCapacity({ event }) {
  const { quota, reservedSeats, availableSeats } = event;
  if (quota === null && availableSeats === null) return null;
  return (
    <div className="event-capacity">
      <div>
        <span>Kuota peserta</span>
        {quota !== null && <strong>{reservedSeats === null ? `${quota} peserta` : `${reservedSeats} / ${quota} terdaftar`}</strong>}
      </div>
      {quota > 0 && reservedSeats !== null && <progress aria-label="Kuota terisi" value={Math.min(quota, reservedSeats)} max={quota} />}
      {availableSeats !== null && <p>{availableSeats ? `${availableSeats} tempat tersedia saat detail dimuat` : 'Kuota penuh saat detail dimuat'}</p>}
    </div>
  );
}

function EventDetail({ eventId, renderRegistration }) {
  const [result, setResult] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getEvent(eventId, { signal: controller.signal })
      .then((event) => {
        if (!controller.signal.aborted) setResult({ status: 'ready', event });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ status: 'error', error });
      });
    return () => controller.abort();
  }, [eventId, attempt]);

  useEffect(() => {
    document.title = result.event ? `${result.event.title} | EventKu` : 'Detail Event | EventKu';
  }, [result.event]);

  if (result.status === 'loading') return <div className="event-feedback" role="status"><span className="spinner" />Memuat detail event…</div>;

  if (result.status === 'error') {
    const unavailable = result.error.status === 404 || result.error.status === 403;
    return (
      <div className="event-feedback" role="alert">
        <h2>{unavailable ? 'Event tidak ditemukan' : 'Detail event gagal dimuat'}</h2>
        <p>{unavailable ? 'Event ini belum tersedia untuk publik atau sudah tidak dapat diakses.' : result.error.message}</p>
        {!unavailable && <button type="button" className="secondary-button" onClick={() => { setResult({ status: 'loading' }); setAttempt((value) => value + 1); }}>Coba lagi</button>}
      </div>
    );
  }

  const { event } = result;
  return (
    <div className="event-detail-grid">
      <div className="event-detail-story">
        <EventPoster event={event} featured />
        <section className="event-detail-panel" aria-labelledby="about-event-title">
          <h2 id="about-event-title">Tentang event</h2>
          <p className="event-description">{event.description || 'Deskripsi belum tersedia.'}</p>
        </section>
      </div>
      <section className="event-detail-panel event-detail-summary" aria-labelledby="event-detail-title">
        {event.categoryName && <span className="event-category">{event.categoryName}</span>}
        <h2 id="event-detail-title">{event.title}</h2>
        <EventMetadata event={event} />
        {event.registrationMode === 'external' ? (
          <section className="rsvp-panel" aria-label="Pendaftaran event">
            <p className="rsvp-note">Pendaftaran dikelola oleh panitia. Tautan dapat dibuka tanpa akun EventKu.</p>
            {event.registrationUrl ? (
              <a className="primary-button" href={event.registrationUrl} target="_blank" rel="noopener noreferrer">
                Daftar di situs lomba
              </a>
            ) : <p className="rsvp-note">Tautan pendaftaran belum tersedia.</p>}
          </section>
        ) : <>
          <EventCapacity event={event} />
          {renderRegistration?.(event)}
        </>}
      </section>
    </div>
  );
}

export default function EventDetailPage({ renderRegistration }) {
  const { eventId } = useParams();
  const { state } = useLocation();
  const catalogSearch = typeof state?.catalogSearch === 'string' ? state.catalogSearch : '';

  return (
    <PageShell>
      <section className="event-detail-hero">
        <div className="event-width">
          <div><h1>Detail Event</h1><p>Kenali kegiatan dan siapkan pengalaman kampusmu berikutnya.</p></div>
          <Link to={{ pathname: '/events', search: catalogSearch }}><Icon name="arrow-left" size={16} />Kembali ke katalog</Link>
        </div>
      </section>
      <div className="catalog-background event-detail-background">
        <div className="event-width"><EventDetail key={eventId} eventId={eventId} renderRegistration={renderRegistration} /></div>
      </div>
    </PageShell>
  );
}
