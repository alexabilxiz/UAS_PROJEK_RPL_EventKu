import { randomUUID } from 'node:crypto';
import { safeRegistrationUrl } from '../src/utils/events.js';

const password = 'EventKuDemo123!';
const categories = [
  { categoryId: 'workshop', name: 'Workshop' },
  { categoryId: 'seminar', name: 'Seminar' },
  { categoryId: 'kompetisi', name: 'Kompetisi' },
];
const organization = { organizationId: 'demo-ukwms', name: 'Komunitas Kampus', status: 'verified' };

function seedEvents() {
  const names = [
    ['Workshop Desain Produk', 'workshop'],
    ['Seminar Karier Teknologi', 'seminar'],
    ['Kompetisi Inovasi Pelajar (Demo)', 'kompetisi'],
    ['Workshop Fotografi Khusus UKWMS (Demo)', 'workshop'],
    ['Seminar Literasi Digital', 'seminar'],
    ['Kompetisi Ide Bisnis', 'kompetisi'],
    ['Workshop Pengembangan Web', 'workshop'],
    ['Seminar Keamanan Siber', 'seminar'],
    ['Kompetisi Poster Kreatif', 'kompetisi'],
    ['Workshop Analisis Data', 'workshop'],
  ];
  return names.map(([title, categoryId], index) => {
    const start = new Date(Date.now() + (index + 2) * 86_400_000);
    const event = {
      eventId: `demo-event-${index + 1}`, title, categoryId,
      categoryName: categories.find((item) => item.categoryId === categoryId).name,
      organizationId: organization.organizationId, organizationName: organization.name,
      description: `Contoh kegiatan kampus untuk mencoba detail dan pendaftaran ${title}.`,
      startAt: start.toISOString(), endAt: new Date(+start + 7_200_000).toISOString(),
      locationOrLink: index % 2 ? 'Ruang Seminar Kampus' : 'Aula Kampus Pakuwon',
      quota: 25, reservedSeats: 0, status: 'disetujui',
    };
    if (index !== 2) return event;
    return {
      ...event, organizationName: 'Panitia UKWMS (Demo)',
      description: 'Contoh lomba kampus untuk peserta dari luar UKWMS. Tautan pendaftaran membuka halaman contoh.',
      registrationMode: 'external', audience: 'Siswa SMA/SMK/sederajat, tim 2–3 siswa.',
      registrationUrl: 'https://example.org/',
    };
  });
}

function paginate(data, query) {
  const page = Math.max(1, Number.parseInt(query.get('page'), 10) || 1);
  const limit = Math.max(1, Math.min(20, Number.parseInt(query.get('limit'), 10) || 20));
  return { data: data.slice((page - 1) * limit, page * limit), total: data.length, page };
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 32_768) throw new Error('Payload terlalu besar.');
  }
  return JSON.parse(raw);
}

export function eventkuDemo() {
  const events = seedEvents();
  const accounts = new Map([
    ['mahasiswa@demo.test', {
      password,
      user: { userId: 'demo-mahasiswa', name: 'Mahasiswa UKWMS Demo', email: 'mahasiswa@demo.test', role: 'mahasiswa', status: 'active', ukwmsVerified: true },
    }],
    ['mahasiswa.luar@demo.test', {
      password,
      user: { userId: 'demo-mahasiswa-luar', name: 'Mahasiswa Kampus Lain Demo', email: 'mahasiswa.luar@demo.test', role: 'mahasiswa', status: 'active' },
    }],
    ['penyelenggara@demo.test', {
      password,
      user: { userId: 'demo-penyelenggara', name: 'Penyelenggara Demo', email: 'penyelenggara@demo.test', role: 'penyelenggara', status: 'active', organization },
    }],
    ['admin@demo.test', {
      password,
      user: { userId: 'demo-admin', name: 'Admin Demo', email: 'admin@demo.test', role: 'admin', status: 'active' },
    }],
  ]);
  const sessions = new Map();
  const registrations = [];

  async function handle(request, response, url) {
    const path = url.pathname.slice('/api/v1'.length);
    const method = request.method;
    const query = url.searchParams;
    const user = sessions.get(request.headers.authorization);
    function json(status, data) {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(data));
    }
    const error = (status, message) => json(status, { message });
    function allows(role) {
      if (user?.role === role) return true;
      error(user ? 403 : 401, 'Akses demo memerlukan akun dengan peran yang sesuai.');
      return false;
    }

    if (path === '/auth/login' && method === 'POST') {
      const body = await readBody(request);
      const account = accounts.get(body?.email?.toLowerCase());
      if (!account || account.password !== body.password) return error(401, 'Kredensial demo tidak cocok.');
      const accessToken = `demo-${randomUUID()}`;
      sessions.set(`Bearer ${accessToken}`, account.user);
      return json(200, { accessToken, user: account.user });
    }
    if (path === '/auth/register' && method === 'POST') {
      const body = await readBody(request);
      const email = body?.email?.toLowerCase();
      if (!body?.name || !email || body.password?.length < 8 || typeof body.password !== 'string'
          || !['mahasiswa', 'penyelenggara'].includes(body.role)) return error(422, 'Data akun demo belum lengkap.');
      if (accounts.has(email)) return error(409, 'Email sudah terdaftar.');
      if (body.role === 'penyelenggara' && body.organizationId !== organization.organizationId) {
        return error(422, 'Gunakan ID organisasi demo-ukwms.');
      }
      const profile = {
        userId: randomUUID(), name: body.name, email, role: body.role, status: 'active',
        ...(body.role === 'penyelenggara' && { organization: { ...organization, status: 'pending' } }),
      };
      accounts.set(email, { password: body.password, user: profile });
      return json(201, { userId: profile.userId, role: profile.role, status: profile.status, organizationId: profile.organization?.organizationId ?? null });
    }
    if (path === '/auth/me' && method === 'GET') {
      return user ? json(200, user) : error(401, 'Sesi demo berakhir.');
    }
    if (path === '/categories' && method === 'GET') return json(200, { data: categories });

    if (path === '/events' && method === 'GET') {
      const keyword = query.get('q')?.trim().toLowerCase();
      const category = query.get('category');
      const organizer = query.get('organizer');
      const date = query.get('date');
      const from = query.get('from');
      const to = query.get('to');
      const wibDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', dateStyle: 'short' });
      const data = events.filter((event) => event.status === 'disetujui'
        && (!keyword || `${event.title} ${event.description}`.toLowerCase().includes(keyword))
        && (!category || event.categoryId === category)
        && (!organizer || event.organizationId === organizer)
        && (!date || wibDate.format(new Date(event.startAt)) === date)
        && (!from || Date.parse(event.startAt) >= Date.parse(from))
        && (!to || Date.parse(event.startAt) < Date.parse(to)));
      return json(200, paginate(data, query));
    }
    if (path === '/events' && method === 'POST') {
      if (!allows('penyelenggara')) return;
      if (user.organization.status !== 'verified') return error(403, 'Organisasi demo belum terverifikasi.');
      const body = await readBody(request);
      const category = categories.find((item) => item.categoryId === body?.categoryId);
      const external = body?.registrationMode === 'external';
      const audience = typeof body?.audience === 'string' ? body.audience.trim() : '';
      const registrationUrl = safeRegistrationUrl(body?.registrationUrl);
      const validRegistration = external
        ? audience && registrationUrl
        : Number.isSafeInteger(body?.quota) && body.quota > 0;
      if (!category || !body.title || !body.description || !body.locationOrLink || !body.posterUrl
          || !(Date.parse(body.startAt) > Date.now()) || !(Date.parse(body.endAt) > Date.parse(body.startAt))
          || !validRegistration) return error(422, 'Data event belum lengkap.');
      const { title, description, startAt, endAt, locationOrLink, posterUrl, quota } = body;
      const eventId = randomUUID();
      events.push({
        eventId, title, description, startAt, endAt, locationOrLink, posterUrl, audience,
        ...(external ? { registrationMode: 'external', registrationUrl } : { quota }),
        categoryId: category.categoryId, categoryName: category.name,
        organizationId: user.organization.organizationId, organizationName: user.organization.name,
        reservedSeats: 0, status: 'draft',
      });
      return json(201, { eventId, status: 'draft' });
    }

    const eventRoute = /^\/events\/([^/]+)(?:\/(submit|registrations))?$/.exec(path);
    if (eventRoute) {
      const event = events.find((item) => item.eventId === eventRoute[1]);
      const action = eventRoute[2];
      const owner = user?.role === 'penyelenggara' && user.organization.organizationId === event?.organizationId;
      if (!event || (event.status !== 'disetujui' && !owner)) return error(404, 'Event tidak tersedia.');
      if (method === 'GET' && !action) return json(200, { event });
      if (method === 'PATCH' && action === 'submit') {
        if (!allows('penyelenggara')) return;
        if (!owner || user.organization.status !== 'verified') return error(403, 'Draft hanya dapat diajukan pemilik terverifikasi.');
        if (event.status !== 'draft') return error(409, 'Status draft sudah berubah.');
        event.status = 'menunggu_moderasi';
        return json(200, { status: event.status });
      }
      if (method === 'POST' && action === 'registrations') {
        if (!allows('mahasiswa')) return;
        if (user.ukwmsVerified !== true) {
          return error(403, 'RSVP khusus mahasiswa UKWMS terverifikasi.');
        }
        const existing = registrations.find((row) => row.eventId === event.eventId && row.userId === user.userId);
        if (event.registrationMode === 'external' || event.status !== 'disetujui' || Date.now() >= Date.parse(event.endAt)
            || event.reservedSeats >= event.quota || existing?.status === 'aktif') {
          return error(409, 'Pendaftaran tidak tersedia.');
        }
        const row = existing ?? { registrationId: randomUUID(), eventId: event.eventId, userId: user.userId };
        row.status = 'aktif';
        if (!existing) registrations.push(row);
        event.reservedSeats++;
        return json(201, { registrationId: row.registrationId, status: row.status });
      }
    }
    if (path === '/registrations/me' && method === 'GET') {
      if (!allows('mahasiswa')) return;
      const upcoming = query.get('scope') !== 'history';
      const data = registrations.filter((row) => row.userId === user.userId)
        .map((row) => ({ registrationId: row.registrationId, status: row.status, event: events.find((event) => event.eventId === row.eventId) }))
        .filter((row) => (row.status === 'aktif' && Date.parse(row.event.endAt) > Date.now()) === upcoming);
      return json(200, paginate(data, query));
    }
    const registrationRoute = /^\/registrations\/([^/]+)$/.exec(path);
    if (registrationRoute && method === 'DELETE') {
      if (!allows('mahasiswa')) return;
      const row = registrations.find((item) => item.registrationId === registrationRoute[1] && item.userId === user.userId);
      if (!row) return error(404, 'Pendaftaran tidak tersedia.');
      const event = events.find((item) => item.eventId === row.eventId);
      if (row.status !== 'aktif' || Date.now() >= Date.parse(event.startAt)) return error(409, 'Pendaftaran tidak dapat dibatalkan.');
      row.status = 'dibatalkan';
      event.reservedSeats--;
      return json(200, { message: 'Pendaftaran dibatalkan.' });
    }
    return error(404, 'Endpoint demo tidak tersedia.');
  }

  return {
    name: 'eventku-local-demo',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (!url.pathname.startsWith('/api/v1/')) return next();
        handle(request, response, url).catch(() => {
          if (!response.headersSent) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ message: 'Permintaan demo tidak valid.' }));
          }
        });
      });
    },
  };
}
