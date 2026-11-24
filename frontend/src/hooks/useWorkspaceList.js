import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { WORKSPACE_PAGE_SIZE } from '../services/workspaceService';

export function useWorkspaceList(list) {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState({ loading: true });
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const action = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    list({ page, token, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil(result.total / WORKSPACE_PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
      else setView({ result });
    }).catch((error) => {
      if (!controller.signal.aborted) setView({ error: error.message });
    });
    return () => controller.abort();
  }, [list, page, reload, token]);

  useEffect(() => () => action.current?.abort(), [token]);

  function load(nextPage = page) {
    setView({ loading: true });
    if (nextPage === page) setReload((value) => value + 1);
    else setPage(nextPage);
  }

  async function run(task, message, { refresh = true } = {}) {
    if (action.current) return false;
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    setFeedback(null);
    try {
      await task({ token, signal: controller.signal });
      if (controller.signal.aborted) return false;
      setFeedback({ message });
      if (refresh) load();
      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        if (refresh && (!error.status || error.status >= 500)) {
          setFeedback({ error: true, message: 'Hasil belum dapat dipastikan. Daftar dimuat ulang untuk memeriksa perubahan.' });
          load();
        } else {
          setFeedback({ error: true, message: error.message });
        }
      }
      return false;
    } finally {
      action.current = null;
      setBusy(false);
    }
  }

  return { ...view, feedback, busy, page, load, run };
}
