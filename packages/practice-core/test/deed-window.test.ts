import { describe, expect, it } from 'vitest';
import { anchorsFor, isSlotSuitable, isTimeInWindow, validateDeedWindow, windowBounds, type DeedWindow } from '../src/index.js';

const DUHA: DeedWindow = { from: 'sunrise', to: 'dhuhr', fromMinutes: 15, toMinutes: -10, anchors: [] };
const WITR: DeedWindow = { from: 'isha', to: 'fajr', fromMinutes: 20, toMinutes: -10, anchors: ['after-isha', 'before-sleep'] };
const QIYAM: DeedWindow = { from: 'lastThird', to: 'fajr', toMinutes: -10, anchors: [] };
const TIMES = { fajr: '05:00', sunrise: '06:20', dhuhr: '11:40', asr: '14:50', maghrib: '17:10', isha: '18:30' };

describe('deed time windows (owner 2026-11-01)', () => {
  it('Duha: from sunrise + 15 to dhuhr − 10, never after dhuhr, and no prayer anchor', () => {
    expect(windowBounds(DUHA, TIMES)).toEqual({ from: '06:35', to: '11:30' });
    expect(isTimeInWindow('09:30', DUHA, TIMES)).toBe(true);
    expect(isTimeInWindow('12:30', DUHA, TIMES)).toBe(false);
    expect(isTimeInWindow('06:00', DUHA, TIMES)).toBe(false);
    expect(isSlotSuitable({ time: '12:35', anchor: 'after-dhuhr' }, DUHA, TIMES)).toBe(false);
    expect(anchorsFor(DUHA)).toEqual([]);
  });
  it('without sunrise, estimates it late (fajr + 100) so Duha never starts early', () => {
    const { sunrise: _, ...five } = TIMES;
    expect(windowBounds(DUHA, five).from).toBe('06:55');
  });
  it('witr crosses midnight; the last third is computed from maghrib to fajr', () => {
    expect(isTimeInWindow('23:30', WITR, TIMES)).toBe(true);
    expect(isTimeInWindow('02:00', WITR, TIMES)).toBe(true);
    expect(isTimeInWindow('17:00', WITR, TIMES)).toBe(false);
    expect(windowBounds(QIYAM, TIMES)).toEqual({ from: '01:03', to: '04:50' });
    expect(isSlotSuitable({ time: '22:00' }, QIYAM, TIMES)).toBe(false);
  });
  it('no window: every anchor and time is fine', () => {
    expect(anchorsFor(undefined)).toHaveLength(6);
    expect(isSlotSuitable({ time: '03:00' }, undefined)).toBe(true);
  });
  it('validates catalog windows', () => {
    expect(validateDeedWindow(DUHA)).toBeNull();
    expect(validateDeedWindow({ ...DUHA, from: 'noon' })).toMatch('window.from');
    expect(validateDeedWindow({ ...DUHA, anchors: ['after-noon'] })).toMatch('anchors');
    expect(validateDeedWindow({ ...DUHA, extra: 1 })).toMatch('unknown field');
  });
});
