import { createApp } from '../src/app.js';

/**
 * Menjalankan service frontend ASLI (frontend/src/services) terhadap server ini.
 * Service memakai URL relatif `/api/v1`, jadi fetch global diarahkan ke server uji.
 */
export async function startContractServer() {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => realFetch(typeof url === 'string' && url.startsWith('/') ? `${origin}${url}` : url, options);

  // Impor dinamis SETELAH fetch dipasang: apiClient menangkap globalThis.fetch saat modul dimuat.
  const dir = '../../frontend/src/services';
  const [auth, events, submission, moderation, registration, workspace] = await Promise.all([
    import(`${dir}/authService.js`), import(`${dir}/eventService.js`), import(`${dir}/eventSubmissionService.js`),
    import(`${dir}/eventModerationService.js`), import(`${dir}/registrationService.js`), import(`${dir}/workspaceService.js`),
  ]);
  return {
    origin,
    authService: auth.authService,
    eventService: events,
    submission,
    moderation,
    registrationService: registration.registrationService,
    workspaceService: workspace.workspaceService,
    async close() {
      globalThis.fetch = realFetch;
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
