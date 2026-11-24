import FormField from './FormField';
import Icon from './Icon';
import { useAuth } from '../hooks/useAuth';
import { useFormAction } from '../hooks/useFormAction';
import { uploadEventPoster } from '../services/eventSubmissionService';
import { isEventPosterReference, POSTER_TYPES } from '../utils/eventSubmission';

function PosterFields({ field, busy, values, onPosterUploaded, onPosterBusy }) {
  const { token } = useAuth();
  const upload = useFormAction();
  const poster = field('posterUrl');
  return <div className="submission-poster-box">
    <span className="feature-icon"><Icon name="calendar" size={24} /></span>
    <FormField id="poster-file" label="Unggah poster" type="file" accept={POSTER_TYPES.join(',')}
      hint="JPG, PNG, atau WebP. Maksimal 2 MB." disabled={busy || upload.busy}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        onPosterBusy(true);
        upload.run(async (signal) => {
          try {
            const url = await uploadEventPoster(file, { token, signal });
            if (!signal.aborted) onPosterUploaded(url);
          } finally {
            if (!signal.aborted) onPosterBusy(false);
          }
        }, 'Poster berhasil diunggah.');
      }} />
    {upload.error && <p className="field-error" role="alert">{upload.error}</p>}
    {(upload.busy || upload.message) && <p role="status">{upload.busy ? 'Mengunggah poster…' : upload.message}</p>}
    <FormField {...poster} required={false} label="URL poster" inputMode="url" placeholder="https://…"
      disabled={upload.busy} hint="Isi tautan HTTPS jika poster sudah tersedia secara online." />
    {isEventPosterReference(values.posterUrl.trim()) && <a href={values.posterUrl.trim()} target="_blank" rel="noreferrer">Periksa tautan poster</a>}
  </div>;
}

export default function EventSubmissionFields({
  busy, field, values, organizationId, categoryResult, retryCategories, onPosterUploaded, onPosterBusy,
}) {
  return (
    <div className="submission-grid">
      <fieldset disabled={Boolean(busy)} className="submission-info">
        <legend>Informasi event</legend>
        <FormField {...field('title')} label="Judul event" placeholder="Masukkan judul event" />
        <FormField {...field('description')} label="Deskripsi">
          <textarea rows={4} placeholder="Ceritakan tujuan dan kegiatan yang akan berlangsung." />
        </FormField>
        <div className="submission-fields">
          <FormField {...field('categoryId')} label="Kategori">
            <select disabled={categoryResult.loading || !categoryResult.data.length}>
              <option value="">{categoryResult.loading ? 'Memuat kategori…' : 'Pilih kategori'}</option>
              {categoryResult.data.map(({ categoryId, name }) => <option key={categoryId} value={categoryId}>{name}</option>)}
            </select>
          </FormField>
          <FormField id="submission-organization" label="ID organisasi" value={organizationId} readOnly />
        </div>
        {categoryResult.error && <p role="status" className="submission-category-message">{categoryResult.error} <button type="button" onClick={retryCategories}>Muat ulang</button></p>}
        {!categoryResult.loading && !categoryResult.error && categoryResult.data.length === 0 && <p className="submission-category-message" role="status">Belum ada kategori aktif.</p>}
        <div className="submission-fields">
          <FormField {...field('startAt')} label="Mulai (WIB)" type="datetime-local" />
          <FormField {...field('endAt')} label="Selesai (WIB)" type="datetime-local" />
          <FormField {...field('locationOrLink')} label="Lokasi atau tautan" placeholder="Aula kampus atau tautan pertemuan" />
          <FormField {...field('registrationMode')} label="Cara daftar"
            hint={values.registrationMode === 'internal' ? 'RSVP tersedia untuk mahasiswa UKWMS terverifikasi.' : undefined}>
            <select>
              <option value="internal">RSVP di EventKu</option>
              <option value="external">Daftar lewat tautan panitia</option>
            </select>
          </FormField>
          <FormField {...field('audience')} required={values.registrationMode === 'external'}
            label="Siapa yang boleh ikut?" placeholder={values.registrationMode === 'external'
              ? 'Contoh: siswa SMA/SMK, tim 2–3 orang' : 'Ketentuan tambahan, jika ada'} maxLength={180} />
          {values.registrationMode === 'external'
            ? <FormField {...field('registrationUrl')} label="Tautan pendaftaran panitia" type="url" placeholder="https://…" />
            : <FormField {...field('quota')} label="Kuota peserta" type="number" min={1} step={1} placeholder="Contoh 80" />}
        </div>
      </fieldset>

      <fieldset disabled={Boolean(busy)} className="submission-poster">
        <legend>Poster event</legend>
        <PosterFields field={field} busy={busy} values={values} onPosterUploaded={onPosterUploaded} onPosterBusy={onPosterBusy} />
        <div className="submission-tip"><strong>Tips pengajuan</strong><p>Periksa jam mulai, jam selesai, dan kapasitas. Detail yang lengkap memudahkan admin meninjau event.</p></div>
      </fieldset>
    </div>
  );
}
