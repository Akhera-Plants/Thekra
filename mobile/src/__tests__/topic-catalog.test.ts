/**
 * The sins and good-deeds lists, categorized (owner, 2026-11-01): chips with counts, the quick filter, folded search,
 * and domain groups in the website's order.
 */

import { catalogChips, catalogSections, matchesQuery, sortCatalog, type CatalogEntry } from '../lib/topic-catalog';
import { SinRank } from '../lib/types/enums';

const entry = (slug: string, nameAr: string, over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  slug,
  name: slug,
  nameAr,
  quoteCount: 1,
  ...over,
});

const SINS: CatalogEntry[] = [
  entry('ghibah', 'الغيبة', { domainKey: 'lisan', taxonomyOrder: 2, rank: SinRank.KABIRA }),
  entry('kadhib', 'الكذب', { domainKey: 'lisan', taxonomyOrder: 1 }),
  entry('riba', 'الربا', { domainKey: 'mal', taxonomyOrder: 1, rank: SinRank.KABIRA }),
  entry('kibr', 'الكِبْر', { domainKey: 'qalb', taxonomyOrder: 1 }),
  entry('other', 'أخرى', { domainKey: null }),
];

describe('topic catalog', () => {
  it('sorts by the website’s domain order, then the taxonomy order; unknown domains last', () => {
    expect(sortCatalog(SINS).map((e) => e.slug)).toEqual(['kibr', 'kadhib', 'ghibah', 'riba', 'other']);
  });

  it('offers «الكل», the quick filter and each present domain, with counts', () => {
    expect(catalogChips(SINS, { kabira: true })).toEqual([
      { key: 'all', count: 5 },
      { key: 'kabira', count: 2 },
      { key: 'qalb', count: 1 },
      { key: 'lisan', count: 2 },
      { key: 'mal', count: 1 },
    ]);
    const deeds = [entry('salah', 'الصلاة', { domainKey: 'ibadat' }), entry('sadaqah', 'الصدقة', { domainKey: 'mal' })];
    expect(catalogChips(deeds, { habitDeeds: new Set(['salah']) }).map((c) => c.key)).toEqual(['all', 'habits', 'ibadat', 'mal']);
    // No chip for a quick filter with nothing in it.
    expect(catalogChips(deeds, { habitDeeds: new Set() }).map((c) => c.key)).toEqual(['all', 'ibadat', 'mal']);
  });

  it('groups by domain with no chip and no search; one list otherwise', () => {
    const grouped = catalogSections(SINS, 'all', '');
    expect(grouped.map((s) => s.domain)).toEqual(['qalb', 'lisan', 'mal', null]);
    expect(grouped[1]!.data.map((e) => e.slug)).toEqual(['kadhib', 'ghibah']);
    expect(catalogSections(SINS, 'kabira', '', { kabira: true })).toEqual([{ domain: null, data: [SINS[0], SINS[2]] }]);
    expect(catalogSections(SINS, 'lisan', '')[0]!.data.map((e) => e.slug)).toEqual(['kadhib', 'ghibah']);
    expect(catalogSections(SINS, 'all', 'الربا')).toEqual([{ domain: null, data: [SINS[2]] }]);
    expect(catalogSections(SINS, 'mal', 'الكذب')).toEqual([]);
  });

  it('searches folded Arabic, names and aliases', () => {
    expect(matchesQuery(SINS[3]!, 'الكبر')).toBe(true);
    expect(matchesQuery(entry('tark-salah', 'ترك الصلاة', { aliases: ['الصلاة'] }), 'صلاه')).toBe(true);
    expect(matchesQuery(SINS[0]!, 'Ghibah')).toBe(true);
    expect(matchesQuery(SINS[0]!, 'ربا')).toBe(false);
  });
});

describe('new strings', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ar = require('../lib/i18n/ar.json');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require('../lib/i18n/en.json');
  it('exist in both languages', () => {
    for (const group of [ar.myHabits, en.myHabits, ar.catalog, en.catalog, ar.practice.window, en.practice.window]) expect(group).toBeDefined();
    expect(Object.keys(ar.myHabits).sort()).toEqual(Object.keys(en.myHabits).sort());
    expect(Object.keys(ar.catalog).sort()).toEqual(Object.keys(en.catalog).sort());
    expect(Object.keys(ar.practice.window).sort()).toEqual(Object.keys(en.practice.window).sort());
    expect(ar.practice.ramadanHintNotRamadan).toBeUndefined();
  });
});
