import fs from 'node:fs';
import { setupDatabase, api, createUser, createOrganization, createCategory, bearer, eventBody } from './helpers.js';
const out = [];
test('organizer impersonation + forgot password', async () => {
  const pool = await setupDatabase();
  const cat = await createCategory(pool, 'Workshop');
  const org = await createOrganization(pool, { name: 'UKM Resmi', status: 'verified' });
  const admin = await createUser(pool, { role: 'admin', email: 'admin@kampus.test' });
  const real = await createUser(pool, { role: 'penyelenggara', email: 'real@x.test', organizationId: org });
  let r = await api().post('/api/v1/events').set(bearer(real)).send(eventBody(cat, { title: 'Acara Resmi' }));
  await api().patch(`/api/v1/events/${r.body.eventId}/submit`).set(bearer(real));
  await api().patch(`/api/v1/admin/events/moderation/${r.body.eventId}`).set(bearer(admin)).send({ status: 'disetujui' });
  const pub = await api().get('/api/v1/events');
  const exposed = JSON.stringify(pub.body.data[0]);
  const orgId = pub.body.data[0].organization?.organizationId ?? pub.body.data[0].organizationId ?? pub.body.data[0].organization?.id;
  out.push({ exposedOrgId: Boolean(orgId), sample: exposed.slice(0, 300) });
  if (orgId) {
    r = await api().post('/api/v1/auth/register').send({ name: 'Penyusup', email: 'penyusup@mail.test', password: 'Rahasia12345', role: 'penyelenggara', organizationId: orgId });
    out.push({ registerAsOrganizerStatus: r.status });
    const login = await api().post('/api/v1/auth/login').send({ email: 'penyusup@mail.test', password: 'Rahasia12345' });
    const h = { Authorization: 'Bearer ' + login.body.accessToken };
    r = await api().post('/api/v1/events').set(h).send(eventBody(cat, { title: 'Acara Palsu atas nama UKM Resmi' }));
    out.push({ createEventAsImpostor: r.status });
    r = await api().get('/api/v1/organizer/events').set(h);
    out.push({ impostorSeesRealOrgEvents: r.body.total });
  }
  fs.writeFileSync('./uat_extra.json', JSON.stringify(out, null, 2));
});
