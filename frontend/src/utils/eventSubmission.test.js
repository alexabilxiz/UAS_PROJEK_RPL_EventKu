import { describe, expect, it } from 'vitest';
import { prepareEventDraft } from './eventSubmission';

const categories = [{ categoryId: 'category-7', name: 'Workshop' }];
const values = {
  title: '  Workshop EventKu  ', description: ' Materi desain aplikasi ', categoryId: 'category-7',
  startAt: '2030-11-15T09:00', endAt: '2030-11-15T10:30',
  locationOrLink: ' Aula kampus ', quota: '60', posterUrl: ' https://events.example.com/poster.png ',
};
const now = Date.parse('2030-11-15T01:59:00Z');

describe('prepareEventDraft', () => {
  it('converts explicit WIB input to API timestamps independent of browser timezone', () => {
    expect(prepareEventDraft(values, categories, now)).toEqual({
      errors: {},
      payload: {
        title: 'Workshop EventKu', description: 'Materi desain aplikasi', categoryId: 'category-7',
        startAt: '2030-11-15T02:00:00.000Z', endAt: '2030-11-15T03:30:00.000Z',
        locationOrLink: 'Aula kampus', quota: 60, posterUrl: 'https://events.example.com/poster.png',
      },
    });
  });

  it('does not accept a nonexistent calendar date rolled over by Date.parse', () => {
    const invalid = prepareEventDraft({ ...values, startAt: '2031-02-29T09:00' }, categories, now);
    expect(invalid.payload).toBeUndefined();
    expect(invalid.errors.startAt).toBe('Isi waktu mulai yang valid.');
  });

  it('rejects past or reversed schedules, unknown categories and invalid quota or poster', () => {
    const invalid = prepareEventDraft({
      ...values, categoryId: 'archived', startAt: '2030-11-15T08:30', endAt: '2030-11-15T08:00',
      quota: '1.5', posterUrl: 'https:example.com/poster.png',
    }, categories, now);
    expect(invalid.payload).toBeUndefined();
    expect(Object.keys(invalid.errors)).toEqual(['categoryId', 'startAt', 'endAt', 'quota', 'posterUrl']);
  });
});
