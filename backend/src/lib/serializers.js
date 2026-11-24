const iso = (value) => (value instanceof Date ? value.toISOString() : value ?? null);

export const EVENT_SELECT = `
  SELECT e.*, c.name AS category_name, o.name AS organization_name
  FROM events e
  JOIN categories c ON c.id = e.category_id
  JOIN organizations o ON o.id = e.organization_id`;

/** Bentuk event untuk API. `internal` menambah field milik penyelenggara/admin. */
export function serializeEvent(row, { internal = false } = {}) {
  const external = row.registration_mode === 'external';
  const quota = external ? null : row.quota;
  const event = {
    eventId: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    startAt: iso(row.start_at),
    endAt: iso(row.end_at),
    locationOrLink: row.location_or_link,
    posterUrl: row.poster_url,
    registrationMode: row.registration_mode,
    audience: row.audience,
    registrationUrl: row.registration_url,
    quota,
    reservedSeats: row.reserved_seats,
    availableSeats: external ? null : Math.max(0, quota - row.reserved_seats),
    status: row.status,
  };
  if (internal) {
    event.version = row.version;
    event.submittedAt = iso(row.submitted_at);
    if (row.status === 'ditolak') event.rejectionReason = row.rejection_reason;
  }
  return event;
}

export const USER_SELECT = `
  SELECT u.*, o.name AS organization_name, o.status AS organization_status
  FROM users u
  LEFT JOIN organizations o ON o.id = u.organization_id`;

export function serializeUser(row) {
  const user = {
    userId: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    photoUrl: row.photo_url,
    emailEnabled: row.email_enabled,
  };
  if (row.role === 'mahasiswa' && row.ukwms_verified) user.ukwmsVerified = true;
  if (row.organization_id) {
    user.organizationId = row.organization_id;
    user.organizationStatus = row.organization_status;
    user.organization = {
      organizationId: row.organization_id,
      name: row.organization_name,
      status: row.organization_status,
    };
  }
  return user;
}

export { iso };
