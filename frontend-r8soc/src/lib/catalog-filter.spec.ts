import { describe, expect, it } from 'vitest';
import { domainChips, filterTopics, groupByDomain, OTHER_DOMAIN, type CatalogFilter, type FilterableTopic } from './catalog-filter';

const topic = (nameAr: string, domainKey: string | null, extra: Partial<FilterableTopic> = {}): FilterableTopic => ({
  nameAr,
  name: null,
  domainKey,
  taxonomyOrder: 0,
  kabira: false,
  ...extra,
});
const entries = [
  topic('الغيبة', 'lisan', { kabira: true, taxonomyOrder: 2 }),
  topic('الكذب', 'lisan', { taxonomyOrder: 1 }),
  topic('ترك الصلاة', 'ibadat', { kabira: true }),
  topic('الربا', 'mal', { kabira: true, hasHabit: true }),
  topic('موضوع', null),
];
const none: CatalogFilter = { query: '', domain: null, kabiraOnly: false, habitOnly: false };

describe('catalogue filters', () => {
  it('counts each domain in the taxonomy order, «أخرى» last', () => {
    expect(domainChips(entries, none)).toEqual([
      { key: 'ibadat', count: 1 },
      { key: 'lisan', count: 2 },
      { key: 'mal', count: 1 },
      { key: OTHER_DOMAIN, count: 1 },
    ]);
  });

  it('keeps the chip counts in step with the search and the switch', () => {
    expect(domainChips(entries, { ...none, kabiraOnly: true }).find((c) => c.key === 'lisan')?.count).toBe(1);
    expect(domainChips(entries, { ...none, query: 'الكذب' }).map((c) => c.count)).toEqual([0, 1, 0, 0]);
  });

  it('shows no chips when no entry has a domain (the branches)', () => {
    expect(domainChips([topic('أ', null), topic('ب', null)], none)).toEqual([]);
  });

  it('filters by domain, switch and folded search, sorted by domain then order', () => {
    expect(filterTopics(entries, { ...none, domain: 'lisan' }).map((e) => e.nameAr)).toEqual(['الكذب', 'الغيبة']);
    expect(filterTopics(entries, { ...none, kabiraOnly: true }).map((e) => e.nameAr)).toEqual(['ترك الصلاة', 'الغيبة', 'الربا']);
    expect(filterTopics(entries, { ...none, habitOnly: true }).map((e) => e.nameAr)).toEqual(['الربا']);
    expect(filterTopics(entries, { ...none, query: 'الغيبه' }).map((e) => e.nameAr)).toEqual(['الغيبة']);
  });

  it('groups in domain order', () => {
    expect(groupByDomain(entries).map((g) => [g.key, g.entries.length])).toEqual([
      ['ibadat', 1],
      ['lisan', 2],
      ['mal', 1],
      [OTHER_DOMAIN, 1],
    ]);
  });
});
