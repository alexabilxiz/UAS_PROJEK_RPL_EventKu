import { randomUUID } from 'node:crypto';
import { isEventTimestamp, safeRegistrationUrl } from '../src/utils/events.js';
import { participantsCsv } from './participantsCsv.js';
import { studentActivity } from './studentActivity.js';
import { accountActions, hashPassword, matchesPassword } from './accountActions.js';
import { isEventPosterReference, isUploadPoster } from '../src/utils/eventSubmission.js';
import { posterAssets } from './posterAssets.js';

const password = hashPassword('EventKuDemo123!');
const demoCategories = [
  { categoryId: 'workshop', name: 'Workshop' },
  { categoryId: 'seminar', name: 'Seminar' },
  { categoryId: 'kompetisi', name: 'Kompetisi' },
];
function seedEvents(categories, organization) {
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
      quota: 25, reservedSeats: 0, status: 'disetujui', posterUrl: 'https://example.org/poster.png',
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

async function readBody(request, limit = 32_768) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > limit) throw new Error('Payload terlalu besar.');
  }
  return JSON.parse(raw);
}

export function eventkuDemo() {
  const categories = demoCategories.map((category) => ({ ...category, isActive: true }));
  const organization = { organizationId: 'demo-ukwms', name: 'Komunitas Kampus', status: 'verified' };
  const pendingOrganization = { organizationId: 'demo-organisasi-baru', name: 'Komunitas Mahasiswa Baru', status: 'pending' };
  const organizations = [organization, pendingOrganization];
  const events = seedEvents(categories, organization);
  events.push({
    ...events[0], eventId: 'demo-moderation-1', title: 'Workshop Presentasi Efektif (Demo)',
    description: 'Lokakarya untuk berlatih menyusun dan menyampaikan presentasi kampus.',
    status: 'menunggu_moderasi', submittedAt: new Date().toISOString(),
  }, {
    ...events[1], eventId: 'demo-moderation-2', title: 'Seminar Persiapan Magang (Demo)',
    description: 'Sesi persiapan magang dan peninjauan CV untuk mahasiswa.',
    status: 'menunggu_moderasi', submittedAt: new Date().toISOString(),
  });
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
    ['penyelenggara.baru@demo.test', {
      password,
      user: { userId: 'demo-penyelenggara-baru', name: 'Penyelenggara Baru Demo', email: 'penyelenggara.baru@demo.test', role: 'penyelenggara', status: 'active', organization: pendingOrganization },
    }],
    ['admin@demo.test', {
      password,
      user: { userId: 'demo-admin', name: 'Admin Demo', email: 'admin@demo.test', role: 'admin', status: 'active' },
    }],
  ]);
  const sessions = new Map();
  events.push({
    ...events[0], eventId: 'demo-event-selesai', title: 'Lokakarya Orientasi (Demo)',
    startAt: new Date(Date.now() - 172_800_000).toISOString(),
    endAt: new Date(Date.now() - 86_400_000).toISOString(), status: 'selesai', reservedSeats: 1,
  });
  const registrations = [{
    registrationId: 'demo-registration-selesai', eventId: 'demo-event-selesai', userId: 'demo-mahasiswa',
    registeredAt: new Date(Date.now() - 259_200_000).toISOString(), status: 'aktif',
  }];
  const moderationNotices = [];
  const moderationHistory = [];
  const activity = studentActivity({ accounts, events, registrations, categories });
  const handleAccount = accountActions(accounts, sessions);
  const posters = posterAssets();

  function updateTimedEvents(now = Date.now()) {
    for (const event of events) {
      if (event.status === 'disetujui' && Date.parse(event.endAt) <= now) event.status = 'selesai';
    }
    activity.checkReminders(now);
  }

  function eventFields(body, organizationId, current) {
    const { title, description, startAt, endAt, locationOrLink, posterUrl, quota } = body ?? {};
    const category = categories.find((item) => item.categoryId === body?.categoryId
      && (item.isActive || item.categoryId === current?.categoryId));
    const external = body?.registrationMode === 'external';
    const audience = typeof body?.audience === 'string' ? body.audience.trim() : '';
    const registrationUrl = safeRegistrationUrl(body?.registrationUrl);
    if (!category || ![title, description, locationOrLink].every((value) => typeof value === 'string' && value.trim())
        || !isEventPosterReference(posterUrl ?? '')
        || (isUploadPoster(posterUrl) && !posters.owned(posterUrl, organizationId))
        || !isEventTimestamp(startAt) || !isEventTimestamp(endAt) || !(Date.parse(startAt) > Date.now())
        || !(Date.parse(endAt) > Date.parse(startAt))
        || (external ? !audience || !registrationUrl : !Number.isSafeInteger(quota) || quota < 1)) return null;
    return {
      title: title.trim(), description: description.trim(), startAt, endAt, locationOrLink: locationOrLink.trim(),
      posterUrl, audience, registrationMode: external ? 'external' : 'internal',
      registrationUrl: external ? registrationUrl : '', quota: external ? null : quota,
      categoryId: category.categoryId, categoryName: category.name,
    };
  }

  async function handle(request, response, url) {
    const path = url.pathname.slice('/api/v1'.length);
    const method = request.method;
    const query = url.searchParams;
    const authorization = request.headers.authorization;
    const profile = sessions.get(authorization);
    const user = profile?.status === 'active' ? profile : undefined;
    updateTimedEvents();
    function json(status, data) {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(data));
    }
    const error = (status, message) => json(status, { message });
    function allows(role) {
      if (user?.role === role && user.status === 'active') return true;
      error(user ? 403 : 401, 'Akses demo memerlukan akun dengan peran yang sesuai.');
      return false;
    }
    const context = { path, method, query, user, authorization, read: (limit) => readBody(request, limit), json, error, allows, paginate };
    if (await handleAccount(context) || await activity.handle(context) || await posters.handle(context, response)) return;

    if (path === '/auth/login' && method === 'POST') {
      const body = await readBody(request);
      const account = accounts.get(typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '');
      if (account?.user.status !== 'active' || !matchesPassword(body.password, account.password)) return error(401, 'Kredensial demo tidak cocok.');
      const accessToken = `demo-${randomUUID()}`;
      sessions.set(`Bearer ${accessToken}`, account.user);
      return json(200, { accessToken, user: account.user });
    }
    if (path === '/auth/register' && method === 'POST') {
      const body = await readBody(request);
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (typeof body?.name !== 'string' || !body.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128
          || !['mahasiswa', 'penyelenggara'].includes(body.role)) return error(422, 'Data akun demo belum lengkap.');
      if (accounts.has(email)) return error(409, 'Email sudah terdaftar.');
      if (body.role === 'penyelenggara'
          && (body.organizationId !== pendingOrganization.organizationId || pendingOrganization.status !== 'pending')) {
        return error(422, 'Gunakan organisasi demo yang masih menunggu verifikasi.');
      }
      const profile = {
        userId: randomUUID(), name: body.name, email, role: body.role, status: 'active',
        ...(body.role === 'penyelenggara' && { organization: pendingOrganization }),
      };
      accounts.set(email, { password: hashPassword(body.password), user: profile });
      return json(201, { userId: profile.userId, role: profile.role, status: profile.status, organizationId: profile.organization?.organizationId ?? null });
    }
    if (path === '/auth/me' && method === 'GET') {
      return user ? json(200, user) : error(401, 'Sesi demo berakhir.');
    }
    if (path === '/categories' && method === 'GET') {
      return json(200, { data: categories.filter((category) => category.isActive) });
    }

    if (path === '/admin/users' && method === 'GET') {
      if (!allows('admin')) return;
      const data = Array.from(accounts.values(), ({ user: person }) => ({
        userId: person.userId, name: person.name, email: person.email, role: person.role, status: person.status,
      }));
      return json(200, paginate(data, query));
    }
    const userRoute = /^\/admin\/users\/([^/]+)$/.exec(path);
    if (userRoute && method === 'PATCH') {
      if (!allows('admin')) return;
      const person = Array.from(accounts.values()).find(({ user: account }) => account.userId === userRoute[1])?.user;
      const { status } = (await readBody(request)) ?? {};
      if (!person) return error(404, 'Akun tidak ditemukan.');
      if (person.role === 'admin') return error(403, 'Akun admin dilindungi.');
      if (!['active', 'disabled'].includes(status)) return error(422, 'Status akun tidak valid.');
      person.status = status;
      if (status === 'disabled') {
        for (const [key, account] of sessions) if (account.userId === person.userId) sessions.delete(key);
      }
      return json(200, { userId: person.userId, status });
    }
    if (path === '/admin/statistics' && method === 'GET') {
      if (!allows('admin')) return;
      const months = new Map();
      for (const event of events) {
        const month = new Date(Date.parse(event.startAt) + 25_200_000).toISOString().slice(0, 7);
        months.set(month, (months.get(month) ?? 0) + 1);
      }
      return json(200, {
        users: accounts.size, events: events.length, registrations: registrations.filter((row) => row.status === 'aktif'
          && events.some((event) => event.eventId === row.eventId && event.status !== 'dibatalkan')).length,
        categories: categories.map((category) => ({
          label: category.name, total: events.filter((event) => event.categoryId === category.categoryId).length,
        })),
        months: [...months].sort(([first], [second]) => first.localeCompare(second)).map(([label, total]) => ({ label, total })),
      });
    }

    if (path === '/admin/organizations' && method === 'GET') {
      if (!allows('admin')) return;
      return json(200, paginate(organizations, query));
    }
    const organizationRoute = /^\/admin\/organizations\/([^/]+)$/.exec(path);
    if (organizationRoute && method === 'PATCH') {
      if (!allows('admin')) return;
      const { status } = (await readBody(request)) ?? {};
      const target = organizations.find((item) => item.organizationId === organizationRoute[1]);
      if (!target) return error(404, 'Organisasi tidak ditemukan.');
      if (!['verified', 'suspended'].includes(status)) return error(422, 'Status organisasi tidak valid.');
      target.status = status;
      return json(200, target);
    }

    if (path === '/admin/categories' && method === 'GET') {
      if (!allows('admin')) return;
      return json(200, paginate(categories, query));
    }
    const categoryRoute = /^\/admin\/categories\/([^/]+)$/.exec(path);
    if ((path === '/admin/categories' && method === 'POST') || (categoryRoute && method === 'PATCH')) {
      if (!allows('admin')) return;
      const body = await readBody(request);
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 80 || (categoryRoute && typeof body.isActive !== 'boolean')) {
        return error(422, 'Nama atau status kategori tidak valid.');
      }
      const category = categories.find((item) => item.categoryId === categoryRoute?.[1]);
      if (categoryRoute && !category) return error(404, 'Kategori tidak ditemukan.');
      if (categories.some((item) => item !== category && item.name.toLowerCase() === name.toLowerCase())) {
        return error(409, 'Nama kategori sudah digunakan.');
      }
      if (!category) {
        const created = { categoryId: randomUUID(), name, isActive: true };
        categories.push(created);
        return json(201, created);
      }
      Object.assign(category, { name, isActive: body.isActive });
      for (const event of events) {
        if (event.categoryId === category.categoryId) event.categoryName = name;
      }
      return json(200, category);
    }

    if (path === '/admin/events/moderation' && method === 'GET') {
      if (!allows('admin')) return;
      const scope = query.get('scope');
      const data = scope === 'history' ? moderationHistory : scope === 'published'
        ? events.filter((event) => event.status === 'disetujui')
        : events.filter((event) => event.status === 'menunggu_moderasi')
          .sort((first, second) => first.submittedAt.localeCompare(second.submittedAt));
      return json(200, paginate(data, query));
    }
    const moderationRoute = /^\/admin\/events\/moderation\/([^/]+)$/.exec(path);
    if (moderationRoute && method === 'PATCH') {
      if (!allows('admin')) return;
      const body = await readBody(request);
      const { status } = body ?? {};
      const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
      if (!['disetujui', 'ditolak', 'dibatalkan'].includes(status)
          || (status !== 'disetujui' && (!reason || reason.length > 500))) {
        return error(422, 'Keputusan atau alasan penolakan tidak valid.');
      }
      const event = events.find((item) => item.eventId === moderationRoute[1]);
      if (!event) return error(404, 'Event tidak tersedia.');
      const expected = status === 'dibatalkan' ? 'disetujui' : 'menunggu_moderasi';
      if (event.status !== expected) return error(409, 'Status event sudah berubah.');
      if (status === 'disetujui' && Date.parse(event.endAt) <= Date.now()) return error(409, 'Jadwal event sudah berakhir.');
      event.status = status;
      if (status === 'ditolak') event.rejectionReason = reason;
      const moderatedAt = new Date().toISOString();
      moderationHistory.unshift({ historyId: randomUUID(), eventId: event.eventId, title: event.title, status, reason, adminName: user.name, moderatedAt });
      moderationNotices.unshift({
        notificationId: randomUUID(), organizationId: event.organizationId, title: event.title,
        status, reason, eventId: event.eventId, createdAt: moderatedAt, readers: new Set(),
      });
      if (status === 'disetujui') activity.bus.emit('published', event);
      if (status === 'dibatalkan') activity.bus.emit('schedule', event, true);
      return json(200, { eventId: event.eventId, status });
    }

    if (path === '/notifications/me' && method === 'GET') {
      if (!allows('penyelenggara')) return;
      const data = moderationNotices.filter((notice) => notice.organizationId === user.organization.organizationId)
        .map(({ organizationId, readers, ...notice }) => ({ ...notice, isRead: readers.has(user.userId) }));
      return json(200, paginate(data, query));
    }
    const notificationRoute = /^\/notifications\/me\/([^/]+)\/read$/.exec(path);
    if (notificationRoute && method === 'PATCH') {
      if (!allows('penyelenggara')) return;
      const notice = moderationNotices.find((item) => item.notificationId === notificationRoute[1]
        && item.organizationId === user.organization.organizationId);
      if (!notice) return error(404, 'Notifikasi tidak ditemukan.');
      notice.readers.add(user.userId);
      return json(200, { notificationId: notice.notificationId, isRead: true });
    }

    if (path === '/organizer/events' && method === 'GET') {
      if (!allows('penyelenggara')) return;
      const data = events.filter((event) => event.organizationId === user.organization.organizationId);
      return json(200, paginate(data, query));
    }
    if (path === '/organizer/statistics' && method === 'GET') {
      if (!allows('penyelenggara')) return;
      const owned = events.filter((event) => event.organizationId === user.organization.organizationId
        && event.registrationMode !== 'external' && event.status !== 'dibatalkan');
      const eventIds = new Set(owned.map((event) => event.eventId));
      const active = registrations.filter((row) => row.status === 'aktif' && eventIds.has(row.eventId));
      const quota = owned.filter((event) => ['disetujui', 'selesai'].includes(event.status)).reduce((sum, event) => sum + (event.quota ?? 0), 0);
      const filled = owned.filter((event) => ['disetujui', 'selesai'].includes(event.status)).reduce((sum, event) => sum + event.reservedSeats, 0);
      const counts = new Map();
      for (const row of active) {
        const date = new Date(Date.parse(row.registeredAt) + 25_200_000).toISOString().slice(0, 10);
        counts.set(date, (counts.get(date) ?? 0) + 1);
      }
      return json(200, {
        active: active.length, occupancy: quota ? Math.round(100 * filled / quota) : 0,
        trend: [...counts].sort(([first], [second]) => first.localeCompare(second)).map(([label, total]) => ({ label, total })),
      });
    }
    const organizerEventRoute = /^\/organizer\/events\/([^/]+)$/.exec(path);
    if (organizerEventRoute && ['GET', 'PATCH'].includes(method)) {
      if (!allows('penyelenggara')) return;
      const event = events.find((item) => item.eventId === organizerEventRoute[1]
        && item.organizationId === user.organization.organizationId);
      if (!event) return error(404, 'Event organisasi tidak ditemukan.');
      if (method === 'GET') return json(200, { event });
      if (user.organization.status !== 'verified') return error(403, 'Organisasi belum terverifikasi.');
      const body = await readBody(request);
      if (!['draft', 'menunggu_moderasi', 'disetujui', 'ditolak'].includes(event.status)
          || body?.expectedStatus !== event.status || body?.expectedVersion !== (event.version ?? 0)) {
        return error(409, 'Event sudah berubah.');
      }
      if (body.action === 'cancel') {
        event.status = 'dibatalkan';
        activity.bus.emit('schedule', event, true);
      } else if (body.action === 'update') {
        const fields = eventFields(body.event, event.organizationId, event);
        if (!fields) return error(422, 'Data event belum lengkap.');
        if (event.reservedSeats > 0 && (fields.registrationMode === 'external' || fields.quota < event.reservedSeats)) {
          return error(409, 'Kuota atau mode pendaftaran bertentangan dengan peserta aktif.');
        }
        const scheduleChanged = ['startAt', 'endAt', 'locationOrLink'].some((field) => fields[field] !== event[field]);
        const wasPublished = event.status === 'disetujui';
        Object.assign(event, fields);
        if (event.status === 'ditolak') event.status = 'draft';
        if (wasPublished && scheduleChanged) {
          event.status = 'menunggu_moderasi';
          event.submittedAt = new Date().toISOString();
          activity.bus.emit('schedule', event, false);
        }
      } else return error(422, 'Aksi event tidak valid.');
      event.version = (event.version ?? 0) + 1;
      return json(200, { event });
    }
    const participantsRoute = /^\/organizer\/events\/([^/]+)\/participants$/.exec(path);
    if (participantsRoute && method === 'GET') {
      if (!allows('penyelenggara')) return;
      if (user.organization.status !== 'verified') return error(403, 'Organisasi belum terverifikasi.');
      const event = events.find((item) => item.eventId === participantsRoute[1]
        && item.organizationId === user.organization.organizationId);
      if (!event) return error(404, 'Event organisasi tidak ditemukan.');
      const people = new Map(Array.from(accounts.values(), ({ user: person }) => [person.userId, person]));
      const data = registrations.filter((row) => row.eventId === event.eventId && row.status === 'aktif')
        .map(({ registrationId, userId, registeredAt }) => ({
          registrationId, registeredAt, name: people.get(userId).name, email: people.get(userId).email,
        }));
      if (query.get('format') === 'csv') return json(200, { csv: participantsCsv(data) });
      return json(200, { ...paginate(data, query), eventTitle: event.title });
    }

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
        && (!to || Date.parse(event.startAt) < Date.parse(to)))
        .sort((first, second) => Date.parse(first.startAt) - Date.parse(second.startAt));
      return json(200, paginate(data, query));
    }
    if (path === '/events' && method === 'POST') {
      if (!allows('penyelenggara')) return;
      if (user.organization.status !== 'verified') return error(403, 'Organisasi demo belum terverifikasi.');
      const fields = eventFields(await readBody(request), user.organization.organizationId);
      if (!fields) return error(422, 'Data event belum lengkap.');
      const eventId = randomUUID();
      events.push({
        eventId, ...fields,
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
        if (Date.parse(event.startAt) <= Date.now()) return error(422, 'Jadwal draft harus diperbarui.');
        event.status = 'menunggu_moderasi';
        event.submittedAt = new Date().toISOString();
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
        row.registeredAt = new Date().toISOString();
        if (!existing) registrations.push(row);
        event.reservedSeats++;
        activity.bus.emit('registration', event, user.userId);
        return json(201, { registrationId: row.registrationId, status: row.status });
      }
    }
    if (path === '/registrations/me' && method === 'GET') {
      if (!allows('mahasiswa')) return;
      const upcoming = query.get('scope') !== 'history';
      const data = registrations.filter((row) => row.userId === user.userId)
        .map((row) => ({ registrationId: row.registrationId, status: row.status, event: events.find((event) => event.eventId === row.eventId) }))
        .filter((row) => (row.status === 'aktif' && !['selesai', 'dibatalkan'].includes(row.event.status)
          && Date.parse(row.event.endAt) > Date.now()) === upcoming);
      return json(200, paginate(data, query));
    }
    const registrationRoute = /^\/registrations\/([^/]+)$/.exec(path);
    if (registrationRoute && method === 'DELETE') {
      if (!allows('mahasiswa')) return;
      const row = registrations.find((item) => item.registrationId === registrationRoute[1] && item.userId === user.userId);
      if (!row) return error(404, 'Pendaftaran tidak tersedia.');
      const event = events.find((item) => item.eventId === row.eventId);
      if (row.status !== 'aktif' || event.status === 'dibatalkan' || Date.now() >= Date.parse(event.startAt)) return error(409, 'Pendaftaran tidak dapat dibatalkan.');
      row.status = 'dibatalkan';
      event.reservedSeats--;
      return json(200, { message: 'Pendaftaran dibatalkan.' });
    }
    return error(404, 'Endpoint demo tidak tersedia.');
  }

  return {
    name: 'eventku-local-demo',
    configureServer(server) {
      const timer = setInterval(() => updateTimedEvents(), 30_000);
      timer.unref();
      server.httpServer?.once('close', () => clearInterval(timer));
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
