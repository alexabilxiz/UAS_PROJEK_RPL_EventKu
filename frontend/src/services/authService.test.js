import { describe, expect, it, vi } from 'vitest';
import { createAuthService, normalizeUser } from './authService';

const student = { userId: 'student-1', name: 'Bambang', email: 'bambang@example.test', role: 'mahasiswa', status: 'active' };

describe('Auth service contract', () => {
  it('posts login credentials and validates the returned identity', async () => {
    const request = vi.fn().mockResolvedValue({ accessToken: 'signed.jwt.token', user: student });
    const signal = new AbortController().signal;
    const result = await createAuthService({ request }).login(' bambang@example.test ', ' do not trim ', { signal });
    expect(request).toHaveBeenCalledWith('/auth/login', { method: 'POST', body: { email: 'bambang@example.test', password: ' do not trim ' }, signal });
    expect(result).toEqual({ accessToken: 'signed.jwt.token', user: { ...student, organizationId: null, organizationStatus: '' } });
  });

  it.each([
    { user: student }, { accessToken: '', user: student }, { accessToken: 'a\nb', user: student },
    { accessToken: 'token', user: { ...student, role: 'superadmin' } },
    { accessToken: 'token', user: { role: 'mahasiswa' } },
  ])('rejects malformed login success without accepting a session', async (payload) => {
    const request = vi.fn().mockResolvedValue(payload);
    await expect(createAuthService({ request }).login('a@b.test', 'password')).rejects.toMatchObject({ status: 502 });
  });

  it('posts student registration without organization or secret confirmation fields', async () => {
    const request = vi.fn().mockResolvedValue({ userId: 42, role: 'mahasiswa', status: 'active', organizationId: null });
    const result = await createAuthService({ request }).register({ name: ' Student ', email: ' a@b.test ', password: 'password', role: 'mahasiswa', organizationId: 'ignored', confirmPassword: 'ignored' });
    expect(request).toHaveBeenCalledWith('/auth/register', { method: 'POST', body: { name: 'Student', email: 'a@b.test', password: 'password', role: 'mahasiswa' }, signal: undefined });
    expect(result).toEqual({ userId: '42', role: 'mahasiswa', status: 'active', organizationId: null });
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('password');
  });

  it('requires the administrator-provided organization ID for organizer registration', async () => {
    const request = vi.fn();
    await expect(createAuthService({ request }).register({ name: 'Organizer', email: 'a@b.test', password: 'password', role: 'penyelenggara' })).rejects.toMatchObject({ status: 422, fieldErrors: { organizationId: expect.any(String) } });
    expect(request).not.toHaveBeenCalled();
  });

  it('sends organizer ID and retains a pending response without granting privileges', async () => {
    const request = vi.fn().mockResolvedValue({ userId: 'org-user', role: 'penyelenggara', status: 'pending', organizationId: 'org-1' });
    const result = await createAuthService({ request }).register({ name: 'Organizer', email: 'a@b.test', password: 'password', role: 'penyelenggara', organizationId: 'org-1' });
    expect(request.mock.calls[0][1].body.organizationId).toBe('org-1');
    expect(result.status).toBe('pending');
    expect(result).not.toHaveProperty('accessToken');
  });

  it('blocks public admin signup before any request', async () => {
    const request = vi.fn();
    await expect(createAuthService({ request }).register({ name: 'Admin', email: 'a@b.test', password: 'password', role: 'admin' })).rejects.toMatchObject({ status: 422, fieldErrors: { role: expect.any(String) } });
    expect(request).not.toHaveBeenCalled();
  });

  it('recovers identity from /me and treats that server response as authoritative', async () => {
    const request = vi.fn().mockResolvedValue({ user: { ...student, role: 'penyelenggara', status: 'pending', organization: { id: 'org-1', status: 'pending' } } });
    const user = await createAuthService({ request }).getMe('saved.jwt');
    expect(request).toHaveBeenCalledWith('/auth/me', { token: 'saved.jwt', signal: undefined });
    expect(user).toMatchObject({ role: 'penyelenggara', status: 'pending', organizationId: 'org-1', organizationStatus: 'pending' });
  });

  it('also accepts the root /me response defined by the API contract', async () => {
    const request = vi.fn().mockResolvedValue(student);
    expect(await createAuthService({ request }).getMe('saved.jwt')).toMatchObject({ userId: 'student-1', role: 'mahasiswa' });
  });

  it('refuses missing tokens before calling /me', async () => {
    const request = vi.fn();
    await expect(createAuthService({ request }).getMe('')).rejects.toMatchObject({ status: 401 });
    expect(request).not.toHaveBeenCalled();
  });

  it('does not invent account or organization verification status', () => {
    expect(normalizeUser({ userId: '1', role: 'penyelenggara' })).toEqual({
      userId: '1', name: '', email: '', role: 'penyelenggara', status: '', organizationId: null, organizationStatus: '',
    });
  });
});
