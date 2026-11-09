const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function toWibTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}:00+07:00`);
  if (!Number.isFinite(time)) return null;

  // Date.parse can roll an impossible calendar date into the following month.
  const roundTrip = new Date(time + WIB_OFFSET_MS).toISOString().slice(0, 16);
  return roundTrip === value ? time : null;
}

export function isHttpsPoster(value) {
  if (!/^https:\/\//i.test(value) || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function prepareEventDraft(values, categories, now = Date.now()) {
  const title = values.title.trim();
  const description = values.description.trim();
  const locationOrLink = values.locationOrLink.trim();
  const posterUrl = values.posterUrl.trim();
  const quota = Number(values.quota);
  const start = toWibTimestamp(values.startAt);
  const end = toWibTimestamp(values.endAt);
  const errors = {};

  if (!title) errors.title = 'Isi judul event.';
  if (!description) errors.description = 'Isi deskripsi event.';
  if (!categories.some(({ categoryId }) => categoryId === values.categoryId)) {
    errors.categoryId = 'Pilih kategori aktif.';
  }
  if (start === null) errors.startAt = 'Isi waktu mulai yang valid.';
  else if (start <= now) errors.startAt = 'Waktu mulai harus setelah waktu sekarang.';
  if (end === null) errors.endAt = 'Isi waktu selesai yang valid.';
  else if (start !== null && end <= start) errors.endAt = 'Waktu selesai harus setelah waktu mulai.';
  if (!locationOrLink) errors.locationOrLink = 'Isi lokasi atau tautan event.';
  if (!/^\d+$/.test(values.quota) || !Number.isSafeInteger(quota) || quota <= 0) {
    errors.quota = 'Isi kuota dengan bilangan bulat lebih dari nol.';
  }
  if (!isHttpsPoster(posterUrl)) errors.posterUrl = 'Isi URL poster HTTPS yang valid.';

  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    payload: {
      title, description, categoryId: values.categoryId,
      startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(),
      locationOrLink, posterUrl, quota,
    },
  };
}
