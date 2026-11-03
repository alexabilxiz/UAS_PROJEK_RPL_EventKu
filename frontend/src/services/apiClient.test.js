import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './apiClient';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});

afterEach(() => vi.useRealTimers());

describe('API JSON transport', () => {
  it('sends the declared JSON contract and Bearer token without cookies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ userId: 'student-1' }));
    const client = createApiClient({ baseUrl: 'https://api.example.test/api/v1/', fetchImpl });
    const body = { email: 'student@example.test', password: 'example password' };
    await client.request('/auth/login', { method: 'POST', body, token: 'example.jwt.token' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/login', expect.objectContaining({
      method: 'POST', credentials: 'omit', body: JSON.stringify(body),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer example.jwt.token' },
    }));
  });

  it('supports a relative base and omits content type on a bodyless request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ userId: 'student-1' }));
    await createApiClient({ fetchImpl }).request('/auth/me', { token: 'token' });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/auth/me');
    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
  });

  it.each([
    'https://user:password@example.test/api', '//example.test/api', 'javascript:alert(1)',
    'http://remote.example.test/api', 'https://example.test/api?password=secret', '/api/../private',
  ])('refuses unsafe API configuration %s before sending anything', async (baseUrl) => {
    const fetchImpl = vi.fn();
    await expect(createApiClient({ baseUrl, fetchImpl }).request('/auth/login')).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('allows HTTP localhost for development', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ ok: true }));
    await createApiClient({ baseUrl: 'http://localhost:3000/api/v1', fetchImpl }).request('/auth/me');
    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:3000/api/v1/auth/me');
  });

  it.each(['https://other.test/auth', '//other.test/auth', '/auth/../admin', '/%2e%2e/admin'])('rejects endpoint escape %s', async (path) => {
    const fetchImpl = vi.fn();
    await expect(createApiClient({ fetchImpl }).request(path)).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses local field messages instead of raw server validation text', async () => {
    const payload = { message: 'Internal database detail', errors: { email: ['Invalid server detail'], password: 'Sensitive detail' } };
    const client = createApiClient({ fetchImpl: vi.fn().mockResolvedValue(json(payload, 422)) });
    const error = await client.request('/auth/register').catch((e) => e);
    expect(error).toMatchObject({ status: 422, retryable: false });
    expect(error.fieldErrors).toEqual({ email: 'Periksa kembali alamat email Anda.', password: 'Periksa kembali kata sandi Anda. Minimal 8 karakter saat mendaftar.' });
    expect(JSON.stringify(error)).not.toMatch(/Sensitive|database|server detail/);
  });

  it.each([
    [401, false], [403, false], [409, false], [429, true], [500, true], [503, true],
  ])('preserves HTTP status %i and deliberate retryability', async (status, retryable) => {
    const client = createApiClient({ fetchImpl: vi.fn().mockResolvedValue(json({ message: 'Internal detail' }, status)) });
    const error = await client.request('/auth/me').catch((e) => e);
    expect(error).toMatchObject({ name: 'ApiError', status, retryable });
    expect(error.message).not.toContain('Internal detail');
  });

  it('handles a proxy HTML error without rendering its content', async () => {
    const client = createApiClient({ fetchImpl: vi.fn().mockResolvedValue(new Response('<html>private debug</html>', { status: 502 })) });
    const error = await client.request('/auth/login').catch((e) => e);
    expect(error.status).toBe(502);
    expect(error.message).not.toContain('private');
  });

  it('refuses a successful non-JSON response instead of accepting it as login data', async () => {
    const client = createApiClient({ fetchImpl: vi.fn().mockResolvedValue(new Response('<html>SPA fallback</html>')) });
    await expect(client.request('/auth/login')).rejects.toMatchObject({ status: 502, retryable: false });
  });

  it('turns a network failure into a safe retryable error', async () => {
    const client = createApiClient({ fetchImpl: vi.fn().mockRejectedValue(new TypeError('Internal network detail')) });
    const error = await client.request('/auth/login').catch((e) => e);
    expect(error).toMatchObject({ status: 0, retryable: true });
    expect(error.message).not.toContain('Internal network detail');
  });

  it('aborts timed out requests and clears its timer', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const pending = createApiClient({ timeoutMs: 50, fetchImpl }).request('/auth/me').catch((e) => e);
    await vi.advanceTimersByTimeAsync(50);
    expect(await pending).toMatchObject({ status: 0, retryable: true });
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves user cancellation without reporting a server error', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const pending = createApiClient({ fetchImpl }).request('/auth/me', { signal: controller.signal }).catch((e) => e);
    controller.abort();
    expect(await pending).toMatchObject({ name: 'AbortError' });
  });

  it('does not start an already cancelled request', async () => {
    const controller = new AbortController(); controller.abort();
    const fetchImpl = vi.fn();
    await expect(createApiClient({ fetchImpl }).request('/auth/me', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
