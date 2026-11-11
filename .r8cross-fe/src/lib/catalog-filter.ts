/**
 * The sins / good-deeds catalogues (owner, 2026-11-01: «تصنيف بدل القوائم الطويلة»): domain chips with counts, a
 * «كبائر» / «لها عادة» switch, the search, and the list grouped by domain. Pure, so the counts and groups are tested.
 */
import { foldArabic, namesMatch } from '@/lib/search/topic-themes';
import { TOPIC_DOMAINS } from '@/lib/topic-domains';

/** Entries without a taxonomy domain gather under this key (shown as «أخرى»). */
export const OTHER_DOMAIN = 'other';

export interface FilterableTopic {
  nameAr: string;
  name?: string | null;
  aliases?: readonly string[];
  domainKey: string | null;
  taxonomyOrder: number | null;
  kabira: boolean;
  hasHabit?: boolean;
}

export interface CatalogFilter {
  /** Already debounced and trimmed. */
  query: string;
  domain: string | null;
  kabiraOnly: boolean;
  habitOnly: boolean;
}

const DOMAIN_ORDER = new Map<string, number>(TOPIC_DOMAINS.map((domain, index) => [domain.key, index]));

export function domainOf(entry: Pick<FilterableTopic, 'domainKey'>): string {
  return entry.domainKey && DOMAIN_ORDER.has(entry.domainKey) ? entry.domainKey : OTHER_DOMAIN;
}

function order(key: string): number {
  return DOMAIN_ORDER.get(key) ?? TOPIC_DOMAINS.length;
}

/** In domain order, then the taxonomy order inside a domain. */
export function sortTopics<T extends FilterableTopic>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => order(domainOf(a)) - order(domainOf(b)) || (a.taxonomyOrder ?? 0) - (b.taxonomyOrder ?? 0));
}

/** Everything but the domain chip: the search and the switches. */
function matchesRest(entry: FilterableTopic, filter: CatalogFilter, needle: string): boolean {
  if (filter.kabiraOnly && !entry.kabira) return false;
  if (filter.habitOnly && !entry.hasHabit) return false;
  return !needle || namesMatch([entry.nameAr, entry.name ?? '', ...(entry.aliases ?? [])], needle);
}

/** The entries the filter keeps, sorted by domain. */
export function filterTopics<T extends FilterableTopic>(entries: readonly T[], filter: CatalogFilter): T[] {
  const needle = foldArabic(filter.query);
  return sortTopics(
    entries.filter((entry) => matchesRest(entry, filter, needle) && (!filter.domain || domainOf(entry) === filter.domain)),
  );
}

/**
 * The domain chips: each domain that has an entry, with how many the search and switches keep in it. Empty when the
 * entries carry no domain at all (the chips would say nothing).
 */
export function domainChips(entries: readonly FilterableTopic[], filter: CatalogFilter): { key: string; count: number }[] {
  if (!entries.some((entry) => domainOf(entry) !== OTHER_DOMAIN)) return [];
  const needle = foldArabic(filter.query);
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = domainOf(entry);
    counts.set(key, (counts.get(key) ?? 0) + (matchesRest(entry, filter, needle) ? 1 : 0));
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => order(a.key) - order(b.key));
}

/** Sorted entries cut into their domains, in domain order. */
export function groupByDomain<T extends FilterableTopic>(entries: readonly T[]): { key: string; entries: T[] }[] {
  const groups: { key: string; entries: T[] }[] = [];
  for (const entry of sortTopics(entries)) {
    const key = domainOf(entry);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, entries: [entry] });
  }
  return groups;
}
