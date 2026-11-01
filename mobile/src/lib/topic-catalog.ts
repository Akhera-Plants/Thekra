/**
 * The sins and good-deeds lists, categorized (owner, 2026-11-01): the website's topic domains as chips with their
 * counts, one quick filter the data supports («الكبائر» for sins, «عادات مقترحة» for good deeds: the deeds a catalog
 * habit maps to), and the search (folded Arabic, as on the website). With no chip and no search the list reads in
 * domain groups, each under its heading, in the website's order (domain, then the taxonomy order). Pure.
 */

import { foldArabic, TOPIC_DOMAIN_KEYS } from '@/lib/topics';
import { SinRank } from '@/lib/types/enums';

export type TopicDomainKey = (typeof TOPIC_DOMAIN_KEYS)[number];

export interface CatalogEntry {
  slug: string;
  name: string;
  nameAr: string;
  domainKey?: string | null;
  taxonomyOrder?: number | null;
  rank?: SinRank | null;
  isContemporary?: boolean;
  quoteCount: number;
  /** Other names the search also matches (a paired page's shared title). */
  aliases?: readonly string[];
}

/** `all`, the quick filter (`kabira` / `habits`), or one domain. */
export type CatalogFilter = 'all' | 'kabira' | 'habits' | TopicDomainKey;

export interface CatalogChip {
  key: CatalogFilter;
  count: number;
}

export interface CatalogSection<T> {
  /** The domain of a group; null for the one list of a chip or a search. */
  domain: TopicDomainKey | null;
  data: T[];
}

const DOMAIN_ORDER = new Map<string, number>(TOPIC_DOMAIN_KEYS.map((key, index) => [key, index]));

function domainOf(entry: CatalogEntry): TopicDomainKey | null {
  return DOMAIN_ORDER.has(entry.domainKey ?? '') ? (entry.domainKey as TopicDomainKey) : null;
}

/** The website's order: by domain (unknown last), then the taxonomy order, then the most texts. */
export function sortCatalog<T extends CatalogEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const da = DOMAIN_ORDER.get(a.domainKey ?? '') ?? 99;
    const db = DOMAIN_ORDER.get(b.domainKey ?? '') ?? 99;
    if (da !== db) return da - db;
    const oa = a.taxonomyOrder ?? Number.MAX_SAFE_INTEGER;
    const ob = b.taxonomyOrder ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return b.quoteCount - a.quoteCount;
  });
}

export interface CatalogOptions {
  /** Offer «الكبائر» (sins). */
  kabira?: boolean;
  /** Offer «عادات مقترحة»: the deed slugs a catalog habit maps to (good deeds). */
  habitDeeds?: ReadonlySet<string>;
}

function matchesFilter(entry: CatalogEntry, filter: CatalogFilter, options: CatalogOptions): boolean {
  if (filter === 'all') return true;
  if (filter === 'kabira') return entry.rank === SinRank.KABIRA;
  if (filter === 'habits') return options.habitDeeds?.has(entry.slug) ?? false;
  return entry.domainKey === filter;
}

/** The chips: «الكل», the quick filter when it has entries, then each domain that has entries, with counts. */
export function catalogChips(entries: readonly CatalogEntry[], options: CatalogOptions = {}): CatalogChip[] {
  const chips: CatalogChip[] = [{ key: 'all', count: entries.length }];
  const quick: CatalogFilter | null = options.kabira ? 'kabira' : options.habitDeeds ? 'habits' : null;
  if (quick) {
    const count = entries.filter((e) => matchesFilter(e, quick, options)).length;
    if (count > 0) chips.push({ key: quick, count });
  }
  for (const key of TOPIC_DOMAIN_KEYS) {
    const count = entries.filter((e) => e.domainKey === key).length;
    if (count > 0) chips.push({ key, count });
  }
  return chips;
}

/** Whether the search text finds the entry (names and aliases, folded). */
export function matchesQuery(entry: CatalogEntry, query: string): boolean {
  const needle = foldArabic(query);
  if (!needle) return true;
  return [entry.nameAr, entry.name, ...(entry.aliases ?? [])].some((name) => foldArabic(name ?? '').includes(needle));
}

/**
 * The list to show: with no chip and no search, one section per domain (entries without a known domain last, under
 * no heading); otherwise one plain section in the website's order.
 */
export function catalogSections<T extends CatalogEntry>(
  entries: readonly T[],
  filter: CatalogFilter,
  query: string,
  options: CatalogOptions = {},
): CatalogSection<T>[] {
  const shown = sortCatalog(entries.filter((e) => matchesFilter(e, filter, options) && matchesQuery(e, query)));
  if (shown.length === 0) return [];
  if (filter !== 'all' || foldArabic(query) !== '') return [{ domain: null, data: shown }];
  const sections: CatalogSection<T>[] = [];
  for (const entry of shown) {
    const domain = domainOf(entry);
    const last = sections[sections.length - 1];
    if (last && last.domain === domain) last.data.push(entry);
    else sections.push({ domain, data: [entry] });
  }
  return sections;
}
