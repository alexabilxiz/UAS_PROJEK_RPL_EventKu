import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

const DAY = 86_400_000;

export function studentActivity({ accounts, events, registrations, categories }) {
  const notifications = [];
  const mail = [];
  const interests = new Map();
  const favorites = new Map();
  const reviews = new Map();
  const reminders = new Set();
  const bus = new EventEmitter();

  function notify(userId, event, type) {
    const account = Array.from(accounts.values()).find(({ user }) => user.userId === userId);
    if (account?.user.status !== 'active') return;
    const notice = {
      userId, eventId: event.eventId, title: event.title, type,
      notificationId: randomUUID(), createdAt: new Date().toISOString(), isRead: false,
    };
    notifications.unshift(notice);
    if (account.emailEnabled) {
      mail.unshift({ notificationId: notice.notificationId, userId, to: account.user.email,
        title: notice.title, type, createdAt: notice.createdAt });
    }
  }
  bus.on('published', (event) => {
    for (const [userId, choices] of interests) {
      if (choices.includes(event.categoryId)) notify(userId, event, 'event_baru');
    }
  });
  bus.on('registration', (event, userId) => notify(userId, event, 'rsvp'));
  bus.on('schedule', (event, cancelled) => {
    for (const row of registrations) {
      if (row.eventId === event.eventId && row.status === 'aktif') {
        notify(row.userId, event, cancelled ? 'event_dibatalkan' : 'jadwal_berubah');
      }
    }
  });

  function checkReminders(now = Date.now()) {
    for (const row of registrations) {
      if (row.status !== 'aktif') continue;
      const event = events.find((item) => item.eventId === row.eventId);
      const startsIn = Date.parse(event.startAt) - now;
      const key = JSON.stringify([row.registrationId, row.registeredAt, event.startAt]);
      if (event.status === 'disetujui' && startsIn > 0 && startsIn <= DAY && !reminders.has(key)) {
        reminders.add(key);
        notify(row.userId, event, 'pengingat');
      }
    }
  }

  async function handle({ path, method, query, user, allows, read, json, error, paginate }) {
    if (path === '/student/demo-mail' && method === 'GET') {
      if (!allows('mahasiswa')) return true;
      json(200, paginate(mail.filter((message) => message.userId === user.userId).map(({ userId, ...row }) => row), query));
      return true;
    }
    const noticeRoute = /^\/student\/notifications\/([^/]+)\/read$/.exec(path);
    if (path === '/student/notifications' || noticeRoute) {
      if (!allows('mahasiswa')) return true;
      if (method === 'GET' && !noticeRoute) {
        checkReminders();
        const data = notifications.filter((row) => row.userId === user.userId).map(({ userId, ...row }) => row);
        json(200, paginate(data, query));
        return true;
      }
      if (method === 'PATCH' && noticeRoute) {
        const notice = notifications.find((row) => row.userId === user.userId && row.notificationId === noticeRoute[1]);
        if (!notice) error(404, 'Notifikasi tidak ditemukan.');
        else {
          notice.isRead = true;
          json(200, { isRead: true });
        }
        return true;
      }
    }
    if (path === '/student/interests' && ['GET', 'PUT'].includes(method)) {
      if (!allows('mahasiswa')) return true;
      if (method === 'PUT') {
        const { categoryIds } = (await read()) ?? {};
        if (!Array.isArray(categoryIds) || !categoryIds.every((id) => categories.some((item) => item.categoryId === id && item.isActive))) {
          error(422, 'Pilih kategori yang aktif.');
          return true;
        }
        interests.set(user.userId, [...new Set(categoryIds)]);
      }
      const categoryIds = (interests.get(user.userId) ?? []).filter((id) => categories.some((item) => item.categoryId === id && item.isActive));
      json(200, { categoryIds });
      return true;
    }
    const favoriteRoute = /^\/student\/favorites\/([^/]+)$/.exec(path);
    if (path === '/student/favorites' || favoriteRoute) {
      if (!allows('mahasiswa')) return true;
      const saved = favorites.get(user.userId) ?? new Set();
      if (method === 'GET') {
        if (favoriteRoute) json(200, { saved: saved.has(favoriteRoute[1]) });
        else json(200, paginate(events.filter((event) => saved.has(event.eventId) && ['disetujui', 'selesai'].includes(event.status)), query));
        return true;
      }
      if (favoriteRoute && ['PUT', 'DELETE'].includes(method)) {
        const eventId = favoriteRoute[1];
        if (method === 'PUT' && !events.some((event) => event.eventId === eventId && event.status === 'disetujui')) {
          error(404, 'Event tidak tersedia.');
          return true;
        }
        if (method === 'PUT') saved.add(eventId);
        else saved.delete(eventId);
        favorites.set(user.userId, saved);
        json(200, { saved: saved.has(eventId) });
        return true;
      }
    }
    const reviewRoute = /^\/student\/reviews\/([^/]+)$/.exec(path);
    if (reviewRoute && ['GET', 'PUT'].includes(method)) {
      if (!allows('mahasiswa')) return true;
      const eventId = reviewRoute[1];
      const event = events.find((item) => item.eventId === eventId);
      if (event?.status !== 'selesai' || !registrations.some((row) => row.eventId === eventId && row.userId === user.userId && row.status === 'aktif')) {
        error(403, 'Ulasan tersedia untuk peserta event yang sudah selesai.');
        return true;
      }
      const key = JSON.stringify([user.userId, eventId]);
      if (method === 'PUT') {
        const { rating, comment } = (await read()) ?? {};
        if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== 'string'
            || !comment.trim() || comment.trim().length > 1000) {
          error(422, 'Beri rating 1 sampai 5 dan isi ulasan hingga 1000 karakter.');
          return true;
        }
        reviews.set(key, { rating, comment: comment.trim() });
      }
      json(200, { title: event.title, review: reviews.get(key) ?? null });
      return true;
    }
    if (path === '/student/notification-preferences' && ['GET', 'PUT'].includes(method)) {
      if (!allows('mahasiswa')) return true;
      const account = accounts.get(user.email);
      if (method === 'PUT') {
        const { emailEnabled } = (await read()) ?? {};
        if (typeof emailEnabled !== 'boolean') {
          error(422, 'Pilihan email tidak valid.');
          return true;
        }
        account.emailEnabled = emailEnabled;
      }
      json(200, { emailEnabled: account.emailEnabled === true });
      return true;
    }
    return false;
  }
  return { bus, handle, checkReminders };
}
