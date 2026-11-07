import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ANCHOR_TIMES, todayFrom } from '@thekra/practice-core';
import { sortedSlots } from './plans';
import {
  anchorTimesForPush,
  myRemindersStore,
  MY_REMINDERS_KEY,
  prayerCacheStore,
  prayerSettingsStore,
  currentPrayerTimes,
  refreshPrayerTimes,
  lookupCity,
} from './screen-stores';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

function install(): MemoryStorage {
  const storage = new MemoryStorage();
  (globalThis as { window?: unknown }).window = { localStorage: storage, addEventListener() {}, removeEventListener() {} };
  for (const store of [myRemindersStore, prayerSettingsStore, prayerCacheStore]) store.reset();
  return storage;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/** An AlAdhan calendar month for the given month (every day the same times). */
function month(year: number, m: number) {
  const days = new Date(year, m, 0).getDate();
  return {
    data: Array.from({ length: days }, (_, i) => ({
      timings: { Fajr: '04:40 (+03)', Dhuhr: '11:45 (+03)', Asr: '14:55 (+03)', Maghrib: '17:20 (+03)', Isha: '18:50 (+03)' },
      date: { gregorian: { date: `${String(i + 1).padStart(2, '0')}-${String(m).padStart(2, '0')}-${year}` } },
    })),
  };
}

describe('screen stores', () => {
  it('keeps «تذكيراتي» device-local and drops invalid lines', () => {
    const storage = install();
    myRemindersStore.update(() => [{ id: 'a', text: '  اذكر الله  ', createdAt: '' }, { id: 'b', text: '' }] as never);
    expect(myRemindersStore.get()).toEqual([{ id: 'a', text: 'اذكر الله', createdAt: '' }]);
    expect(JSON.parse(storage.getItem(MY_REMINDERS_KEY) ?? '[]')).toHaveLength(1);
  });

  it('fetches 30 days of prayer times once, then serves anchor times for push from the cache', async () => {
    install();
    expect(await refreshPrayerTimes()).toBe('unset');
    prayerSettingsStore.update(() => ({ city: 'Riyadh', country: 'SA', offsets: {} }) as never);
    const fetchImpl = vi.fn(async (url: string) => {
      const m = /calendarByAddress\/(\d+)\/(\d+)/.exec(url)!;
      return new Response(JSON.stringify(month(Number(m[1]), Number(m[2]))));
    });
    expect(await refreshPrayerTimes(false, fetchImpl as never)).toBe('updated');
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('method=4');
    expect(await refreshPrayerTimes(false, fetchImpl as never)).toBe('fresh');
    const times = anchorTimesForPush();
    expect(times[todayFrom(new Date())]?.['after-fajr']).toBe('05:00');
  });

  it('keeps the sunrise AlAdhan sends beside the five prayers (Duha starts after it)', async () => {
    install();
    prayerSettingsStore.update(() => ({ city: 'Riyadh', country: 'SA', offsets: { fajr: 5 } }) as never);
    const fetchImpl = vi.fn(async (url: string) => {
      const m = /calendarByAddress\/(\d+)\/(\d+)/.exec(url)!;
      const body = month(Number(m[1]), Number(m[2]));
      for (const day of body.data) (day.timings as Record<string, string>).Sunrise = '06:02 (+03)';
      return new Response(JSON.stringify(body));
    });
    expect(await refreshPrayerTimes(false, fetchImpl as never)).toBe('updated');
    const today = currentPrayerTimes(todayFrom(new Date()));
    expect(today?.sunrise).toBe('06:02');
    expect(today?.fajr).toBe('04:45');
  });

  it('reports a failed fetch and keeps the default times', async () => {
    install();
    prayerSettingsStore.update(() => ({ city: 'Riyadh', country: 'SA' }) as never);
    expect(await refreshPrayerTimes(true, (async () => new Response('', { status: 500 })) as never)).toBe('failed');
    expect(anchorTimesForPush()).toEqual({});
  });

  it('orders anchors and times by their default time when a habit is created', () => {
    expect(sortedSlots(['13:00', 'after-fajr', '13:00'])).toEqual({
      slots: [DEFAULT_ANCHOR_TIMES['after-fajr'], '13:00'],
      slotAnchors: ['after-fajr', null],
    });
    expect(sortedSlots(['21:00', '07:00'])).toEqual({ slots: ['07:00', '21:00'] });
  });
});

describe('lookupCity (round 5: the city only)', () => {
  const meta = { timezone: 'Asia/Amman', latitude: 31.95, longitude: 35.93, method: { id: 4 } };
  const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('asks timingsByAddress with the city alone and reads the place and method', async () => {
    let url = '';
    const fetchImpl = (async (input: RequestInfo | URL) => {
      url = String(input);
      return new Response(JSON.stringify({ code: 200, data: { meta } }), { status: 200 });
    }) as typeof fetch;
    const found = await lookupCity('  Amman ', fetchImpl);
    expect(url).toContain('/v1/timingsByAddress/');
    expect(url).toContain('address=Amman');
    expect(url).not.toContain('method=');
    expect(found).toEqual({ kind: 'found', city: 'Amman', meta: { timezone: 'Asia/Amman', latitude: 31.95, longitude: 35.93, method: 4 } });
  });

  it('says «not found» for an address AlAdhan cannot geocode, and «offline» on a network error or a 5xx', async () => {
    expect(await lookupCity('xyzzy', reply(400, { code: 400, data: 'Unable to geocode address.' }))).toEqual({ kind: 'notFound' });
    expect(await lookupCity('', reply(200, {}))).toEqual({ kind: 'notFound' });
    expect(await lookupCity('Amman', reply(503, {}))).toEqual({ kind: 'offline' });
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await lookupCity('Amman', down)).toEqual({ kind: 'offline' });
  });
});
