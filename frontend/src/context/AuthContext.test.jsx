import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthContext';
import { SESSION_KEY } from './sessionStorage';
import { useAuth } from '../hooks/useAuth';

const student = {
  userId: 'student-1', name: 'Bambang', email: 'bambang@example.test', role: 'mahasiswa',
  status: 'active', organizationId: null, organizationStatus: '',
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function renderAuth(service) {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider service={service}>{children}</AuthProvider>,
  });
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('AuthProvider session verification and races', () => {
  it('finishes anonymous startup without calling the profile endpoint', async () => {
    const service = { getMe: vi.fn() };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(service.getMe).not.toHaveBeenCalled();
  });

  it('does not trust a stored token until /me verifies the profile', async () => {
    sessionStorage.setItem(SESSION_KEY, 'stored-token');
    const profile = deferred();
    const service = { getMe: vi.fn().mockReturnValue(profile.promise) };
    const { result } = renderAuth(service);
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    await act(async () => { profile.resolve(student); await profile.promise; });
    await waitFor(() => expect(result.current.user).toEqual(student));
    expect(result.current.token).toBe('stored-token');
    expect(result.current.role).toBe('mahasiswa');
    expect(service.getMe).toHaveBeenCalledWith('stored-token', { signal: expect.any(AbortSignal) });
  });

  it('clears both session stores after a 401 during restoration', async () => {
    sessionStorage.setItem(SESSION_KEY, 'expired-temporary');
    localStorage.setItem(SESSION_KEY, 'expired-persistent');
    const service = { getMe: vi.fn().mockRejectedValue({ status: 401, message: 'Sesi berakhir.' }) };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it.each([
    { status: 403, message: 'Izin profil belum tersedia.' },
    { status: 0, message: 'Koneksi belum tersedia.' },
  ])('retains stored credentials without granting access on restoration status $status', async (failure) => {
    localStorage.setItem(SESSION_KEY, 'persistent-token');
    const service = { getMe: vi.fn().mockRejectedValue(failure) };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.sessionError).toBe(failure.message);
    expect(localStorage.getItem(SESSION_KEY)).toBe('persistent-token');
  });

  it('can retry a temporary profile failure and restore the verified session', async () => {
    sessionStorage.setItem(SESSION_KEY, 'temporary-token');
    const service = { getMe: vi.fn()
      .mockRejectedValueOnce({ status: 0, message: 'Koneksi terputus.' })
      .mockResolvedValueOnce(student) };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.sessionError).toBe('Koneksi terputus.'));
    await act(async () => { await result.current.retrySession(); });
    expect(result.current.user).toEqual(student);
    expect(result.current.sessionError).toBe('');
    expect(result.current.token).toBe('temporary-token');
  });

  it('does not restore a logged out session when a pending /me completes late', async () => {
    sessionStorage.setItem(SESSION_KEY, 'stored-token');
    const profile = deferred();
    // The fixture deliberately ignores the signal to exercise the operation guard too.
    const service = { getMe: vi.fn().mockReturnValue(profile.promise) };
    const { result } = renderAuth(service);
    await waitFor(() => expect(service.getMe).toHaveBeenCalledTimes(1));
    const signal = service.getMe.mock.calls[0][1].signal;
    act(() => result.current.logout());
    expect(signal.aborted).toBe(true);
    await act(async () => { profile.resolve(student); await profile.promise; });
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('cancels a pending login profile result if the user logs out first', async () => {
    const profile = deferred();
    const service = {
      login: vi.fn().mockResolvedValue({ accessToken: 'new-token', user: student }),
      getMe: vi.fn().mockReturnValue(profile.promise),
    };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.loading).toBe(false));
    let pendingLogin;
    act(() => {
      pendingLogin = result.current.login({ email: student.email, password: 'password', remember: true }).catch((error) => error);
    });
    await waitFor(() => expect(service.getMe).toHaveBeenCalledTimes(1));
    act(() => result.current.logout());
    let error;
    await act(async () => { profile.resolve(student); error = await pendingLogin; });
    expect(error).toMatchObject({ name: 'AbortError' });
    expect(result.current.user).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('uses the /me role rather than the role in the login response', async () => {
    const profile = deferred();
    const service = {
      login: vi.fn().mockResolvedValue({ accessToken: 'verified-token', user: { ...student, role: 'admin' } }),
      getMe: vi.fn().mockReturnValue(profile.promise),
    };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.loading).toBe(false));
    let pendingLogin;
    act(() => { pendingLogin = result.current.login({ email: student.email, password: 'password' }); });
    await waitFor(() => expect(service.getMe).toHaveBeenCalledTimes(1));
    expect(result.current.user).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    await act(async () => { profile.resolve(student); await pendingLogin; });
    expect(result.current.role).toBe('mahasiswa');
    expect(result.current.user).toEqual(student);
  });

  it.each([false, true])('stores only the verified token with remember=%s', async (remember) => {
    const service = {
      login: vi.fn().mockResolvedValue({ accessToken: 'verified-token', user: student }),
      getMe: vi.fn().mockResolvedValue(student),
    };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.loading).toBe(false));
    // A prior persistence preference must not survive a fresh successful login.
    localStorage.setItem(SESSION_KEY, 'old-local');
    sessionStorage.setItem(SESSION_KEY, 'old-session');
    await act(async () => { await result.current.login({ email: student.email, password: 'password', remember }); });
    expect(sessionStorage.getItem(SESSION_KEY)).toBe(remember ? null : 'verified-token');
    expect(localStorage.getItem(SESSION_KEY)).toBe(remember ? 'verified-token' : null);
    expect(Object.values({ ...sessionStorage, ...localStorage }).join(' ')).not.toContain('password');
  });

  it('does not persist credentials if profile verification fails after login', async () => {
    const service = {
      login: vi.fn().mockResolvedValue({ accessToken: 'unverified-token', user: { ...student, role: 'admin' } }),
      getMe: vi.fn().mockRejectedValue({ status: 403, message: 'Akses tidak diizinkan.' }),
    };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.loading).toBe(false));
    let error;
    await act(async () => {
      error = await result.current.login({ email: student.email, password: 'password', remember: true }).catch((failure) => failure);
    });
    expect(error).toMatchObject({ status: 403 });
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('clears the active session when another tab removes the remembered token', async () => {
    localStorage.setItem(SESSION_KEY, 'shared-token');
    const service = { getMe: vi.fn().mockResolvedValue(student) };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.user).toEqual(student));
    // The browser changes shared storage before it delivers the StorageEvent.
    localStorage.removeItem(SESSION_KEY);
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, oldValue: 'shared-token', newValue: null, storageArea: localStorage }));
    });
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(remove.mock.instances).not.toContain(localStorage);
  });

  it('revalidates a replacement token instead of acting on a stale removal event', async () => {
    localStorage.setItem(SESSION_KEY, 'old-token');
    const replacementProfile = { ...student, userId: 'other-user', role: 'penyelenggara' };
    const replacement = deferred();
    const service = { getMe: vi.fn().mockResolvedValueOnce(student).mockReturnValueOnce(replacement.promise) };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.user).toEqual(student));
    localStorage.setItem(SESSION_KEY, 'replacement-token');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, oldValue: 'old-token', newValue: null, storageArea: localStorage }));
    });
    await waitFor(() => expect(service.getMe).toHaveBeenLastCalledWith('replacement-token', { signal: expect.any(AbortSignal) }));
    expect(result.current.loading).toBe(true);
    expect(localStorage.getItem(SESSION_KEY)).toBe('replacement-token');
    await act(async () => { replacement.resolve(replacementProfile); await replacement.promise; });
    expect(result.current.user).toEqual(replacementProfile);
    expect(result.current.token).toBe('replacement-token');
    expect(remove.mock.instances).not.toContain(localStorage);
  });

  it('does not delete a remembered token before replacing it during login', async () => {
    localStorage.setItem(SESSION_KEY, 'old-token');
    const service = {
      login: vi.fn().mockResolvedValue({ accessToken: 'new-token', user: student }),
      getMe: vi.fn().mockResolvedValue(student),
    };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.user).toEqual(student));
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    await act(async () => { await result.current.login({ email: student.email, password: 'password', remember: true }); });
    expect(localStorage.getItem(SESSION_KEY)).toBe('new-token');
    expect(remove.mock.instances).not.toContain(localStorage);
  });

  it('keeps a temporary tab session when another tab logs out its remembered session', async () => {
    sessionStorage.setItem(SESSION_KEY, 'temporary-token');
    const service = { getMe: vi.fn().mockResolvedValue(student) };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.user).toEqual(student));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, oldValue: 'other-token', newValue: null, storageArea: localStorage }));
    });
    expect(result.current.user).toEqual(student);
    expect(result.current.token).toBe('temporary-token');
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('temporary-token');
  });

  it('ignores a storage removal from a sessionStorage iframe', async () => {
    localStorage.setItem(SESSION_KEY, 'remembered-token');
    const service = { getMe: vi.fn().mockResolvedValue(student) };
    const { result } = renderAuth(service);
    await waitFor(() => expect(result.current.user).toEqual(student));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, oldValue: 'iframe-token', newValue: null, storageArea: sessionStorage }));
    });
    expect(result.current.user).toEqual(student);
    expect(localStorage.getItem(SESSION_KEY)).toBe('remembered-token');
  });
});
