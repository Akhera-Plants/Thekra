import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

type StripModule = typeof import('./source-strip');

let mod: StripModule;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
  mod = await import('./source-strip');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const row = (name: string, nameAr: string | null, publishedQuoteCount: number) => ({
  name,
  nameAr,
  publishedQuoteCount,
});

function pageResponse(data: unknown[], hasNext = false, status = 200) {
  return new Response(JSON.stringify({ data, meta: { hasNext } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('rankSourceNames', () => {
  it('drops sources without published texts and orders by published count', () => {
    const names = mod.rankSourceNames(
      [
        row('Sahih Muslim', 'صحيح مسلم', 3),
        row('Al-Fawaid', 'الفوائد', 0),
        row('The Noble Quran', 'القرآن الكريم', 6236),
        row('Sahih al-Bukhari', 'صحيح البخاري', 7000),
      ],
      'ar',
    );
    expect(names).toEqual(['صحيح البخاري', 'القرآن الكريم', 'صحيح مسلم']);
  });

  it('uses only the locale’s own name field, so a missing name is skipped instead of shown in the other script', () => {
    const rows = [row('Riyad as-Salihin', null, 2), row('', 'القرآن الكريم', 5)];
    expect(mod.rankSourceNames(rows, 'ar')).toEqual(['القرآن الكريم']);
    expect(mod.rankSourceNames(rows, 'en')).toEqual(['Riyad as-Salihin']);
  });

  it('lists each name once, keeping the entry with the higher count', () => {
    const names = mod.rankSourceNames(
      [row('Sahih Muslim', 'صحيح مسلم', 1), row('Sahih Muslim', 'صحيح مسلم', 9)],
      'ar',
    );
    expect(names).toEqual(['صحيح مسلم']);
  });

  it('collapses whitespace and ignores blank labels', () => {
    const names = mod.rankSourceNames([row('  Sahih   Muslim ', null, 1), row('   ', '  ', 4)], 'en');
    expect(names).toEqual(['Sahih Muslim']);
  });
});

describe('getSourceStripNames', () => {
  it('returns the ranked published names from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        pageResponse([row('Sahih Muslim', 'صحيح مسلم', 2), row('Al-Fawaid', 'الفوائد', 0)]),
      ),
    );
    await expect(mod.getSourceStripNames('ar')).resolves.toEqual(['صحيح مسلم']);
  });

  it('follows pagination until hasNext is false', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pageResponse([row('A', 'أ', 1)], true))
      .mockResolvedValueOnce(pageResponse([row('B', 'ب', 2)], false));
    vi.stubGlobal('fetch', fetchMock);
    await expect(mod.getSourceStripNames('ar')).resolves.toEqual(['ب', 'أ']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the static list when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    await expect(mod.getSourceStripNames('en')).resolves.toEqual([
      'The Noble Quran',
      'Sahih al-Bukhari',
      'Sahih Muslim',
      'Riyad as-Salihin',
    ]);
  });

  it('falls back when the API answers with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => pageResponse([], false, 500)));
    await expect(mod.getSourceStripNames('ar')).resolves.toEqual([
      'القرآن الكريم',
      'صحيح البخاري',
      'صحيح مسلم',
      'رياض الصالحين',
    ]);
  });

  it('falls back when the payload does not match the expected shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => pageResponse([{ name: 42 }])));
    await expect(mod.getSourceStripNames('ar')).resolves.toHaveLength(4);
  });

  it('never returns the retired Al-Fawaid entry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => pageResponse([])));
    const names = await mod.getSourceStripNames('en');
    expect(names).not.toContain('Al-Fawaid');
  });
});
