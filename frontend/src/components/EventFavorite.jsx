import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFormAction } from '../hooks/useFormAction';
import { workspaceService } from '../services/workspaceService';

export default function EventFavorite({ eventId }) {
  const { user, token } = useAuth();
  return user?.role === 'mahasiswa' && token
    ? <Favorite key={`${user.userId}:${eventId}`} token={token} eventId={eventId} /> : null;
}

function Favorite({ eventId, token }) {
  const [read, setRead] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const change = useFormAction(token);
  useEffect(() => {
    const controller = new AbortController();
    workspaceService.favorite(eventId, { token, signal: controller.signal }).then((saved) => {
      if (!controller.signal.aborted) setRead({ token, saved });
    }).catch((failure) => {
      if (!controller.signal.aborted) setRead({ token, error: failure.message });
    });
    return () => controller.abort();
  }, [attempt, eventId, token]);

  const saved = read?.token === token ? read.saved : undefined;
  const error = read?.token === token && read.error;
  return <div className="event-favorite">
    {error ? <><p role="status">{error}</p><button className="secondary-button" type="button" onClick={() => {
      setRead(null);
      setAttempt((value) => value + 1);
    }}>Periksa favorit</button></>
      : <button className="secondary-button" type="button" disabled={saved === undefined || change.busy} onClick={() => {
        change.run(async (signal) => {
          try {
            const updated = await workspaceService.favorite(eventId, { token, signal }, !saved);
            if (!signal.aborted) setRead({ token, saved: updated });
          } catch (failure) {
            if (!signal.aborted) setRead({ token, error: failure.message });
          }
        });
      }}>
        {change.busy ? 'Menyimpan…' : saved === undefined ? 'Memeriksa favorit…' : saved ? 'Hapus dari favorit' : 'Simpan ke favorit'}
      </button>}
  </div>;
}
