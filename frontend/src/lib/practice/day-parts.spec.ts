import { describe, expect, it } from 'vitest';
import { dayPartOf, groupByDayPart } from './day-parts';

describe('dayPartOf (the app’s bands)', () => {
  it('reads a fixed first reminder against 10:00 and 18:00', () => {
    expect(dayPartOf({ slots: ['06:00'] })).toBe('start');
    expect(dayPartOf({ slots: ['10:00'] })).toBe('during');
    expect(dayPartOf({ slots: ['21:00', '07:00'] })).toBe('end');
  });

  it('reads a prayer anchor by its prayer', () => {
    expect(dayPartOf({ slots: ['05:00'], slotAnchors: ['after-fajr'] })).toBe('start');
    expect(dayPartOf({ slots: ['15:30'], slotAnchors: ['after-asr'] })).toBe('during');
    expect(dayPartOf({ slots: ['18:00'], slotAnchors: ['after-maghrib'] })).toBe('end');
  });

  it('reads a plan without a time as «خلال اليوم»', () => {
    expect(dayPartOf({ slots: [] })).toBe('during');
  });

  it('groups in order and leaves empty parts out', () => {
    const groups = groupByDayPart(['a', 'b', 'c'], (x) => (x === 'b' ? 'end' : 'start'));
    expect(groups).toEqual([
      { part: 'start', items: ['a', 'c'] },
      { part: 'end', items: ['b'] },
    ]);
  });
});
