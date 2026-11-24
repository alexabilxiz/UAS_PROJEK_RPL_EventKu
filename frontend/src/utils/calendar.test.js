import { describe, expect, it } from 'vitest';
import { groupCalendarEvents, monthCells, monthRange, shiftMonth, validMonth, wibDate } from './calendar';

describe('calendar WIB dates', () => {
  it('uses WIB at the UTC month boundary', () => {
    expect(wibDate('2035-10-31T17:00:00Z')).toBe('2035-11-01');
    expect(wibDate('2035-10-31T16:59:59Z')).toBe('2035-10-31');
    expect(monthRange('2035-12')).toEqual({ from: '2035-12-01T00:00:00+07:00', to: '2036-01-01T00:00:00+07:00' });
  });
  it('handles leap years and Monday-first weeks', () => {
    const cells = monthCells('2028-02');
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe('2028-02-01');
    expect(cells.filter(Boolean)).toHaveLength(29);
    expect(monthCells('2027-02').filter(Boolean)).toHaveLength(28);
    expect(monthCells('2026-11')).toHaveLength(42);
  });
  it('handles year transitions and rejects malformed months', () => {
    expect(shiftMonth('2035-01', -1)).toBe('2034-12');
    for (const value of ['2035-00', '2035-13', '35-01', '2035-2', null, '9999-01']) expect(validMonth(value)).toBe(false);
    expect(() => monthRange('2035-13')).toThrow();
  });
  it('groups by local starting day, orders by time, and excludes invalid/outside dates', () => {
    const event = (eventId, startAt) => ({ eventId, startAt, title: eventId });
    const groups = groupCalendarEvents([
      event('later', '2035-11-01T10:00:00Z'), event('first', '2035-10-31T17:00:00Z'),
      event('outside', '2035-11-30T17:00:00Z'), event('invalid', ''),
    ], '2035-11');
    expect(Object.keys(groups)).toEqual(['2035-11-01']);
    expect(groups['2035-11-01'].map((item) => item.eventId)).toEqual(['first', 'later']);
  });
});
