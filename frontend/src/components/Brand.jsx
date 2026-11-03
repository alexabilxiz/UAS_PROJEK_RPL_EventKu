import { Link } from 'react-router-dom';
import Icon from './Icon';

export default function Brand({ compact = false }) {
  return (
    <Link to="/" className={`brand${compact ? ' brand--compact' : ''}`} aria-label="EventKu beranda">
      <span className="brand-icon"><Icon name="calendar" size={21} /></span>
      <span>EventKu</span>
    </Link>
  );
}
