-- Skema EventKu (PostgreSQL / Neon). ID memakai UUID yang dibuat aplikasi.
-- Idempoten: aman dijalankan berulang kali.

CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'pending',   -- pending | verified | suspended
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(254) NOT NULL UNIQUE,           -- disimpan huruf kecil
  password_hash    TEXT         NOT NULL,
  role             VARCHAR(20)  NOT NULL,                  -- mahasiswa | penyelenggara | admin
  status           VARCHAR(20)  NOT NULL DEFAULT 'active', -- active | disabled
  photo_url        TEXT         NOT NULL DEFAULT '',
  ukwms_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
  email_enabled    BOOLEAN      NOT NULL DEFAULT FALSE,
  organization_id  UUID REFERENCES organizations(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Satu baris per token login aktif; dipakai untuk mencabut sesi (ganti sandi, akun dinonaktifkan).
CREATE TABLE IF NOT EXISTS sessions (
  jti         UUID PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  CHAR(64)    PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id                UUID PRIMARY KEY,
  organization_id   UUID         NOT NULL REFERENCES organizations(id),
  category_id       UUID         NOT NULL REFERENCES categories(id),
  title             VARCHAR(200) NOT NULL,
  description       TEXT         NOT NULL,
  start_at          TIMESTAMPTZ  NOT NULL,
  end_at            TIMESTAMPTZ  NOT NULL,
  location_or_link  VARCHAR(500) NOT NULL,
  poster_url        TEXT         NOT NULL,
  registration_mode VARCHAR(10)  NOT NULL DEFAULT 'internal', -- internal | external
  audience          TEXT         NOT NULL DEFAULT '',
  registration_url  TEXT         NOT NULL DEFAULT '',
  quota             INTEGER,                                  -- NULL untuk pendaftaran eksternal
  reserved_seats    INTEGER      NOT NULL DEFAULT 0,
  status            VARCHAR(25)  NOT NULL DEFAULT 'draft',    -- draft | menunggu_moderasi | disetujui | ditolak | selesai | dibatalkan
  version           INTEGER      NOT NULL DEFAULT 0,
  rejection_reason  TEXT         NOT NULL DEFAULT '',
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (reserved_seats >= 0)
);
CREATE INDEX IF NOT EXISTS events_status_start_idx ON events(status, start_at);
CREATE INDEX IF NOT EXISTS events_org_idx ON events(organization_id);

CREATE TABLE IF NOT EXISTS registrations (
  id             UUID PRIMARY KEY,
  event_id       UUID        NOT NULL REFERENCES events(id),
  user_id        UUID        NOT NULL REFERENCES users(id),
  status         VARCHAR(15) NOT NULL DEFAULT 'aktif',        -- aktif | dibatalkan
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS registrations_user_idx ON registrations(user_id);

CREATE TABLE IF NOT EXISTS moderation_history (
  id            UUID PRIMARY KEY,
  event_id      UUID         NOT NULL REFERENCES events(id),
  title         VARCHAR(200) NOT NULL,
  admin_name    VARCHAR(100) NOT NULL,
  status        VARCHAR(15)  NOT NULL,                        -- disetujui | ditolak | dibatalkan
  reason        TEXT         NOT NULL DEFAULT '',
  moderated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Notifikasi hasil moderasi untuk penyelenggara (per organisasi).
CREATE TABLE IF NOT EXISTS organizer_notifications (
  id               UUID PRIMARY KEY,
  organization_id  UUID         NOT NULL REFERENCES organizations(id),
  event_id         UUID         NOT NULL REFERENCES events(id),
  title            VARCHAR(200) NOT NULL,
  status           VARCHAR(15)  NOT NULL,
  reason           TEXT         NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS organizer_notification_reads (
  notification_id  UUID NOT NULL REFERENCES organizer_notifications(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (notification_id, user_id)
);

-- Notifikasi untuk mahasiswa (RSVP, event baru sesuai minat, perubahan jadwal, pengingat).
CREATE TABLE IF NOT EXISTS student_notifications (
  id          UUID PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    UUID         NOT NULL REFERENCES events(id),
  title       VARCHAR(200) NOT NULL,
  type        VARCHAR(25)  NOT NULL,   -- event_baru | rsvp | jadwal_berubah | event_dibatalkan | pengingat
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS student_notifications_user_idx ON student_notifications(user_id);

-- Antrean email. Belum ada SMTP: baris ini dibaca endpoint /student/demo-mail.
CREATE TABLE IF NOT EXISTS email_outbox (
  id          UUID PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_email    VARCHAR(254) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  type        VARCHAR(25)  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Penanda pengingat H-1 agar satu pendaftaran tidak diingatkan dua kali untuk jadwal yang sama.
CREATE TABLE IF NOT EXISTS reminders_sent (
  registration_id  UUID        NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  start_at         TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (registration_id, start_at)
);

CREATE TABLE IF NOT EXISTS student_interests (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id),
  PRIMARY KEY (user_id, category_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id  UUID NOT NULL REFERENCES events(id),
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id   UUID        NOT NULL REFERENCES events(id),
  rating     INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS posters (
  id               UUID PRIMARY KEY,
  organization_id  UUID        NOT NULL REFERENCES organizations(id),
  content_type     VARCHAR(20) NOT NULL,
  data             TEXT        NOT NULL,   -- Base64
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
