import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Swagger UI', () => {
  const app = createApp();

  test('serves the documentation page and bundled UI assets', async () => {
    const page = await request(app).get('/api-docs/');
    expect(page.status).toBe(200);
    expect(page.text).toContain('swagger-ui-bundle.js');

    const bundle = await request(app).get('/api-docs/swagger-ui-bundle.js');
    expect(bundle.status).toBe(200);
    expect(bundle.headers['content-type']).toMatch(/javascript/);
  });

  test('embeds the EventKu OpenAPI document in the UI configuration', async () => {
    const response = await request(app).get('/api-docs/swagger-ui-init.js');
    expect(response.status).toBe(200);
    expect(response.text).toContain('EventKu API');
    expect(response.text).toContain('/events/{eventId}/registrations');
  });
});
