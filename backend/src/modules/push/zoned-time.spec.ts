import { isValidTimeZone, zonedParts, zonedToUtc } from './zoned-time.js';

describe('zoned-time', () => {
  it('reads the local date and time of an instant', () => {
    expect(zonedParts(new Date('2026-10-28T21:30:00Z'), 'Asia/Amman')).toEqual({ date: '2026-10-29', time: '00:30' });
    expect(zonedParts(new Date('2026-10-28T21:30:00Z'), 'UTC')).toEqual({ date: '2026-10-28', time: '21:30' });
  });

  it('turns a local date and time into the right instant', () => {
    expect(zonedToUtc('2026-10-29', '09:30', 'Asia/Amman').toISOString()).toBe('2026-10-29T06:30:00.000Z');
    expect(zonedToUtc('2026-10-29', '09:30', 'Asia/Kolkata').toISOString()).toBe('2026-10-29T04:00:00.000Z');
  });

  it('follows daylight saving time', () => {
    expect(zonedToUtc('2026-07-01', '09:00', 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(zonedToUtc('2026-12-01', '09:00', 'America/New_York').toISOString()).toBe('2026-12-01T14:00:00.000Z');
    // 02:30 does not exist on 2026-03-08 in New York: it lands within the hour of the change.
    const skipped = zonedToUtc('2026-03-08', '02:30', 'America/New_York').getTime();
    expect(Math.abs(skipped - Date.parse('2026-03-08T07:00:00Z'))).toBeLessThanOrEqual(3_600_000);
  });

  it('accepts IANA zones only', () => {
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(3)).toBe(false);
  });
});
