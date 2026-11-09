import Icon from './Icon';

export default function EventPoster({ event, featured = false }) {
  return (
    <div className={`event-poster${featured ? ' event-poster-featured' : ''}`}>
      <div className="event-poster-placeholder"><Icon name="calendar" size={46} /></div>
      {event.posterUrl && (
        <img key={event.posterUrl} src={event.posterUrl} alt="" loading={featured ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer" onError={(error) => { error.currentTarget.hidden = true; }} />
      )}
      <div className="event-poster-labels">
        <span>{event.organizationName || 'Event kampus'}</span>
        {event.categoryName && <span className="event-category">{event.categoryName}</span>}
      </div>
    </div>
  );
}
