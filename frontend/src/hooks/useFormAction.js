import { useEffect, useRef, useState } from 'react';

export function useFormAction(scope) {
  const active = useRef(null);
  const [state, setState] = useState({});
  useEffect(() => () => active.current?.abort(), [scope]);

  async function run(action, message) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState({ scope, busy: true });
    try {
      const result = await action(controller.signal);
      if (!controller.signal.aborted) setState({ scope, message, result });
    } catch (error) {
      if (!controller.signal.aborted) setState({ scope, error: error.message });
    } finally {
      active.current = null;
    }
  }
  return { ...(state.scope === scope && state), run };
}
