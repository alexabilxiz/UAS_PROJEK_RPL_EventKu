import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { authService } from '../services/authService';
import { SESSION_KEY, clearSession, readSession, saveSession } from './sessionStorage';

export const AuthContext = createContext(null);

export function AuthProvider({ children, service = authService }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const operation = useRef(0);
  const pending = useRef(null);

  const endSession = useCallback((persistent = true) => {
    operation.current += 1;
    pending.current?.abort();
    clearSession({ persistent });
    setToken(null);
    setUser(null);
    setLoading(false);
    setSessionError('');
  }, []);

  const logout = useCallback(() => endSession(), [endSession]);

  const restoreSession = useCallback(async () => {
    const current = ++operation.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const stored = readSession();
    setLoading(true);
    setSessionError('');
    try {
      if (!stored) return;
      const profile = await service.getMe(stored.token, { signal: controller.signal });
      if (operation.current === current && !controller.signal.aborted) {
        setUser(profile);
        setToken(stored.token);
      }
    } catch (error) {
      if (controller.signal.aborted || operation.current !== current) return;
      setUser(null);
      setToken(null);
      if (error.status === 401) clearSession();
      else setSessionError(error.message || 'Sesi belum dapat diperiksa. Coba lagi.');
    } finally {
      if (operation.current === current && !controller.signal.aborted) setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    restoreSession();
    return () => { operation.current += 1; pending.current?.abort(); };
  }, [restoreSession]);

  // Shared remembered sessions follow changes from other tabs. Temporary
  // sessionStorage logins remain isolated to their own tab.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== null && event.key !== SESSION_KEY) return;
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      const stored = readSession();
      if (stored && !stored.remember) return;
      // Read the current value instead of trusting a queued deletion event:
      // another tab may have already installed a replacement token.
      if (stored) {
        if (stored.token !== token) restoreSession();
      } else if (event.newValue === null) {
        // Do not write shared storage again while handling its removal.
        endSession(false);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [endSession, restoreSession, token]);

  const login = useCallback(async ({ email, password, remember = false }) => {
    const current = ++operation.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const result = await service.login(email.trim(), password, { signal: controller.signal });
    // Verify the profile with the API; do not use a local role or JWT payload as authority.
    const profile = await service.getMe(result.accessToken, { signal: controller.signal });
    if (operation.current !== current || controller.signal.aborted) throw new DOMException('Permintaan dibatalkan.', 'AbortError');
    saveSession(result.accessToken, remember);
    setToken(result.accessToken);
    setUser(profile);
    setSessionError('');
    setLoading(false);
    return profile;
  }, [service]);

  const register = useCallback((values) => service.register(values), [service]);

  return <AuthContext.Provider value={{ user, token, role: user?.role, loading, sessionError, login, logout, register, retrySession: restoreSession }}>{children}</AuthContext.Provider>;
}
