/**
 * Topic helpers after the website's topic pages.
 *
 * `topicMeta`: the small line under a row of the sins / good-deeds catalogue (website `TopicCatalog`): the domain,
 * «كبيرة», «معاصر»; a topic with none of them shows its number of texts instead.
 *
 * `buildTopicSections`: the reading sections of a topic page, after the website's sin and good-deed pages (frontend
 * `app/[locale]/sins/[slug]/page.tsx`, `useTopicReader`): the topic's own texts, then its companion (the paired
 * deed's virtue on a sin, the opposite sin's warning on a deed), then a contemporary topic's derived groups.
 * Each text shows once: a quote already in an earlier section is left out of a later one. Each section keeps the
 * topic links' notes by quote id (`notes`) for the card's «لماذا هذا الحديث؟».
 * Under a type filter the website reads one list without headings; so does this.
 */

import type { QuoteDto, TopicGroup, TopicText } from '@/lib/types/api';
import { SinRank } from '@/lib/types/enums';

/** The website's topic domains (`TOPIC_DOMAINS`), in its order; labels under `topicMeta.domains`. */
export const TOPIC_DOMAIN_KEYS = ['iman', 'qalb', 'ibadat', 'lisan', 'usra', 'mujtama', 'mal', 'shahawat', 'dima', 'ilm', 'raqami', 'adab'] as const;

export interface TopicMetaEntry {
  domainKey?: string | null;
  rank?: SinRank | null;
  isContemporary?: boolean;
  quoteCount: number;
}

type Translate = (key: string, options?: { count?: number }) => string;

export function topicMeta(entry: TopicMetaEntry, t: Translate): string | undefined {
  const parts: string[] = [];
  if ((TOPIC_DOMAIN_KEYS as readonly string[]).includes(entry.domainKey ?? '')) parts.push(t(`topicMeta.domains.${entry.domainKey}`));
  if (entry.rank === SinRank.KABIRA) parts.push(t('topicMeta.kabira'));
  if (entry.isContemporary) parts.push(t('topicMeta.contemporary'));
  if (parts.length > 0) return parts.join(' · ');
  return entry.quoteCount > 0 ? t('topicMeta.texts', { count: entry.quoteCount }) : undefined;
}

/**
 * Catalogue search folding, the website's `foldArabic` (frontend `lib/search/topic-themes.ts`): tashkeel, tatweel,
 * hamza seats, ta marbuta, alif maqsura and punctuation, so «شعب الايمان» finds «شُعَب الإيمان».
 */
export function foldArabic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ٰٟـۖ-ۭ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/[()[\]{}«»"'.,،؛;:!?؟\-\u2013\u2014_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TopicPageData {
  items: TopicText[];
  companion?: { items: TopicText[] };
  derived?: TopicGroup[];
}

export interface TopicSection {
  key: string;
  /** Null: no heading (one flat list under a filter). */
  title: string | null;
  data: QuoteDto[];
  /** The link note of each text that has one, by quote id. */
  notes: Record<string, string>;
}

export interface TopicSectionOptions {
  /** False under a type filter: one list, no headings, no derived groups. */
  sectioned: boolean;
  ownTitle: string;
  companionTitle: string;
  groupTitle: (group: TopicGroup) => string;
}

export function buildTopicSections(pages: readonly TopicPageData[], options: TopicSectionOptions): TopicSection[] {
  const seen = new Set<string>();
  const notes: Record<string, string> = {};
  const fresh = (rows: readonly TopicText[]) =>
    rows.flatMap((row) => {
      if (seen.has(row.quote.id)) return [];
      seen.add(row.quote.id);
      if (row.link.note) notes[row.quote.id] = row.link.note;
      return [row.quote];
    });

  const own: QuoteDto[] = [];
  const companion: QuoteDto[] = [];
  for (const page of pages) {
    own.push(...fresh(page.items));
    companion.push(...fresh(page.companion?.items ?? []));
  }
  if (!options.sectioned) {
    const flat = [...own, ...companion];
    return flat.length > 0 ? [{ key: 'all', title: null, data: flat, notes }] : [];
  }

  // Derived groups come page by page like the topic's own texts: one group per topic across the pages.
  const groups = new Map<string, { group: TopicGroup; data: QuoteDto[] }>();
  for (const page of pages) {
    for (const group of page.derived ?? []) {
      const key = `${group.side}:${group.slug}`;
      const entry = groups.get(key) ?? { group, data: [] };
      entry.data.push(...fresh(group.items));
      groups.set(key, entry);
    }
  }

  const sections: TopicSection[] = [
    { key: 'own', title: options.ownTitle, data: own, notes },
    { key: 'companion', title: options.companionTitle, data: companion, notes },
    ...[...groups.entries()].map(([key, { group, data }]) => ({ key: `derived:${key}`, title: options.groupTitle(group), data, notes })),
  ];
  return sections.filter((section) => section.data.length > 0);
}
