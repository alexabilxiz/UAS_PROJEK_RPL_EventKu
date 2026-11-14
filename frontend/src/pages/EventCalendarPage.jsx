import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { listMonthEvents } from '../services/calendarService';
import { groupCalendarEvents, monthCells, monthLabel, shiftMonth, validMonth, wibDate } from '../utils/calendar';
import { formatEventDate, formatEventTime, isEventDate } from '../utils/events';
import '../styles/event-calendar.css';

function MonthView({ month, selected, onSelect, search }) {
  const [view, setView] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    listMonthEvents(month, { signal: controller.signal })
      .then((events) => { if (!controller.signal.aborted) setView({ events }); })
      .catch((error) => { if (!controller.signal.aborted) setView({ error }); });
    return () => controller.abort();
  }, [month, attempt]);

  if (view.loading) return <p className="calendar-feedback" role="status">Memuat kalender event…</p>;
  if (view.error) return <div className="calendar-feedback">
    <p className="error-message" role="alert">{view.error.message}</p>
    <button className="secondary-button" onClick={() => { setView({ loading: true }); setAttempt((value) => value + 1); }}>Coba lagi</button>
  </div>;

  const groups = groupCalendarEvents(view.events, month);
  const dates = selected ? [selected] : Object.keys(groups).sort();
  const total = Object.values(groups).reduce((sum, events) => sum + events.length, 0);
  const today = wibDate();
  return <>
    <p className="calendar-summary" role="status">{total} event dimulai pada {monthLabel(month)}. Pilih tanggal untuk melihat agendanya.</p>
    <div className="calendar-grid" role="group" aria-label={`Kalender ${monthLabel(month)}`}>
      {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
      {monthCells(month).map((date, index) => date ? <button key={date} type="button"
        className={`calendar-day${date === today ? ' calendar-today' : ''}`}
        aria-label={`${formatEventDate(`${date}T00:00:00+07:00`)}, ${groups[date]?.length ?? 0} event`}
        aria-pressed={selected === date} aria-current={date === today ? 'date' : undefined}
        onClick={() => onSelect(date)}>
        <span className="calendar-day-number">{Number(date.slice(-2))}</span>
        {!!groups[date]?.length && <><span className="calendar-count">{groups[date].length}<span className="calendar-count-label"> event</span></span>
          <span className="calendar-preview" aria-hidden="true">{groups[date][0].title}</span></>}
      </button> : <div className="calendar-blank" key={`blank-${index}`} aria-hidden="true" />)}
    </div>
    <section className="calendar-agenda" aria-labelledby="agenda-heading">
      <div className="calendar-agenda-heading"><h2 id="agenda-heading">{selected ? `Agenda ${formatEventDate(`${selected}T00:00:00+07:00`)}` : 'Agenda bulan ini'}</h2>
        {selected && <button className="text-button" onClick={() => onSelect('')}>Tampilkan semua tanggal</button>}</div>
      {!dates.some((date) => groups[date]?.length) && <p role="status">{selected ? 'Tidak ada event yang dimulai pada tanggal ini.' : 'Belum ada event untuk bulan ini.'}</p>}
      {dates.filter((date) => groups[date]?.length).map((date) => <div className="calendar-agenda-day" key={date}>
        <h3>{formatEventDate(`${date}T00:00:00+07:00`)}</h3>
        <ul>{groups[date].map((event) => <li key={event.eventId}>
          <span className="calendar-time">{formatEventTime(event.startAt)}</span>
          <div><Link to={`/events/${encodeURIComponent(event.eventId)}`} state={{ calendarSearch: search }}>{event.title}</Link>
            <p>{event.categoryName}{event.categoryName && event.organizationName ? ' · ' : ''}{event.organizationName}</p></div>
        </li>)}</ul>
      </div>)}
    </section>
  </>;
}

export default function EventCalendarPage() {
  const [params, setParams] = useSearchParams();
  const today = wibDate();
  const month = validMonth(params.get('month')) ? params.get('month') : today.slice(0, 7);
  const day = params.get('date');
  const selected = isEventDate(day) && day.startsWith(month) ? day : '';
  const search = new URLSearchParams({ month, ...(selected && { date: selected }) }).toString();
  useEffect(() => { document.title = 'Kalender Event | EventKu'; }, []);
  function navigate(next, date = '') {
    if (validMonth(next)) setParams({ month: next, ...(date && { date }) });
  }
  return <PageShell><section className="calendar-page">
    <div className="calendar-heading"><div><p className="eyebrow">AGENDA KAMPUS</p><h1>Kalender event</h1>
      <p>Rencanakan kegiatan kampusmu. Semua jadwal menggunakan WIB.</p></div><Link className="secondary-button" to="/events">Lihat katalog event</Link></div>
    <div className="calendar-toolbar">
      <div className="calendar-month-nav"><button className="secondary-button" aria-label="Bulan sebelumnya" disabled={!validMonth(shiftMonth(month, -1))} onClick={() => navigate(shiftMonth(month, -1))}>←</button>
        <h2>{monthLabel(month)}</h2><button className="secondary-button" aria-label="Bulan berikutnya" disabled={!validMonth(shiftMonth(month, 1))} onClick={() => navigate(shiftMonth(month, 1))}>→</button></div>
      <div className="calendar-controls"><label htmlFor="calendar-month">Pilih bulan</label><input id="calendar-month" type="month" min="1900-01" max="9998-12" value={month} onChange={(event) => navigate(event.target.value)} />
        <button className="secondary-button" onClick={() => navigate(today.slice(0, 7), today)}>Hari ini</button></div>
    </div>
    <MonthView key={month} month={month} selected={selected} search={search} onSelect={(date) => navigate(month, date)} />
  </section></PageShell>;
}
