import { QuoteType, type Prisma } from '@prisma/client';
import { dedupeReading, READING_SELECT, type ReadingRow } from '../classification/reading.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { normTheme, type TopicTheme } from './topic-themes.js';

/**
 * Theme chips on a topic page. A page is one topic, or a paired sin + deed
 * (taxonomy.yaml pairs:). Both link tables are read with the same reader
 * rules as the list; a text linked to both sides is counted once.
 */
export interface ThemeSides {
  sin?: Prisma.SinQuoteWhereInput;
  deed?: Prisma.GoodDeedQuoteWhereInput;
}

export interface ThemeCount {
  key: string;
  ar: string;
  en: string;
  count: number;
}

/**
 * One chip of a page. `key` is what the response shows and `?theme=` accepts;
 * `keys` are every link key behind it (more than one when the sin side and the
 * deed side of a pair carry the same label, see mergePageThemes).
 */
export interface PageTheme {
  key: string;
  ar: string;
  en: string;
  keys: string[];
}

export interface KindCounts {
  all: number;
  verse: number;
  hadith: number;
  athar: number;
}

function labelOf(theme: TopicTheme): string {
  return normTheme(theme.ar) || normTheme(theme.en);
}

/**
 * The chips of a page, in page order. A paired page shows its own side's themes
 * first, then the other side's. When a sin-side and a deed-side theme share a
 * label (normalised Arabic, English when the Arabic is empty) they become ONE
 * chip: it is keyed by the sin-side theme's key (stable whichever side the
 * reader opened), sits where its first member sat, and carries both keys.
 * Two themes of the same topic are never merged here; that is a yaml mistake
 * and shows up in the theme audit.
 */
export function mergePageThemes(themes: readonly TopicTheme[], sinSlug: string | null): PageTheme[] {
  const groups = new Map<string, TopicTheme[]>();
  for (const theme of themes) groups.set(labelOf(theme), [...(groups.get(labelOf(theme)) ?? []), theme]);
  const result: PageTheme[] = [];
  const done = new Set<string>();
  for (const theme of themes) {
    const label = labelOf(theme);
    if (done.has(label)) continue;
    done.add(label);
    const group = groups.get(label) ?? [theme];
    const topics = new Set(group.map((member) => member.topic));
    if (topics.size < 2) {
      for (const member of group) result.push({ key: member.key, ar: member.ar, en: member.en, keys: [member.key] });
    } else {
      const head = group.find((member) => member.topic === sinSlug) ?? group[0] ?? theme;
      result.push({ key: head.key, ar: head.ar, en: head.en, keys: group.map((member) => member.key) });
    }
  }
  return result;
}

/** The chip a `?theme=` value selects: the chip's own key, or any key merged into it. */
export function findActiveTheme(pageThemes: readonly PageTheme[], requested: string | undefined): PageTheme | null {
  if (!requested) return null;
  return pageThemes.find((theme) => theme.key === requested)
    ?? pageThemes.find((theme) => theme.keys.includes(requested))
    ?? null;
}

const SUMMARY_SELECT = {
  quoteId: true,
  themeKeys: true,
  quote: { select: { type: true, isAthar: true, atharReviewDecision: true } },
} as const;

interface SummaryRow {
  quoteId: string;
  themeKeys: string[];
  quote: { type: QuoteType; isAthar: boolean; atharReviewDecision: string | null };
}

function withKeys<T extends object>(where: T, keys: readonly string[]): T & { themeKeys: { hasSome: string[] } } {
  return { ...where, themeKeys: { hasSome: [...keys] } };
}

function kindOf(row: SummaryRow): 'verse' | 'hadith' | 'athar' | null {
  if (row.quote.type === QuoteType.QURAN_VERSE) return 'verse';
  if (row.quote.type !== QuoteType.HADITH) return null;
  if (!row.quote.isAthar) return 'hadith';
  return row.quote.atharReviewDecision === 'KEEP' ? 'athar' : null;
}

/** Distinct texts behind a chip: the union of its keys' links, so a text under both keys counts once. */
function distinctQuotes(keys: readonly string[], quotesByKey: ReadonlyMap<string, ReadonlySet<string>>): number {
  if (keys.length === 1) return quotesByKey.get(keys[0] as string)?.size ?? 0;
  const union = new Set<string>();
  for (const key of keys) for (const id of quotesByKey.get(key) ?? []) union.add(id);
  return union.size;
}

/**
 * `meta.themes` (every theme of the page, in file order, with its distinct
 * text count) and, for the active theme, the kind counts of its texts.
 * `sides` carry the reader filter without a kind, so counts do not move with the tab.
 */
export async function summariseThemes(
  prisma: PrismaService,
  sides: ThemeSides,
  themes: readonly PageTheme[],
  active: PageTheme | null,
): Promise<{ themes: ThemeCount[]; countsByKind: KindCounts | null }> {
  if (themes.length === 0) return { themes: [], countsByKind: null };
  const keys = themes.flatMap((theme) => theme.keys);
  const [sinRows, deedRows] = await Promise.all([
    sides.sin ? prisma.sinQuote.findMany({ where: withKeys(sides.sin, keys), select: SUMMARY_SELECT }) : Promise.resolve([]),
    sides.deed ? prisma.goodDeedQuote.findMany({ where: withKeys(sides.deed, keys), select: SUMMARY_SELECT }) : Promise.resolve([]),
  ]);
  const rows = [...sinRows, ...deedRows] as SummaryRow[];
  const quotesByKey = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const key of row.themeKeys ?? []) quotesByKey.set(key, (quotesByKey.get(key) ?? new Set()).add(row.quoteId));
  }
  let countsByKind: KindCounts | null = null;
  if (active) {
    const seen = new Set<string>();
    const counts = { verse: 0, hadith: 0, athar: 0 };
    for (const row of rows) {
      if (!(row.themeKeys ?? []).some((key) => active.keys.includes(key)) || seen.has(row.quoteId)) continue;
      seen.add(row.quoteId);
      const kind = kindOf(row);
      if (kind) counts[kind] += 1;
    }
    countsByKind = { all: counts.verse + counts.hadith + counts.athar, ...counts };
  }
  return {
    themes: themes.map((theme) => ({
      key: theme.key,
      ar: theme.ar,
      en: theme.en,
      count: distinctQuotes(theme.keys, quotesByKey),
    })),
    countsByKind,
  };
}

/**
 * One reading-ordered, deduped page over both sides of the page for a theme.
 * `sides` already carry the kind filter and `themeKeys: { has }`.
 */
export async function readThemedPage<TItem>(
  prisma: PrismaService,
  sides: ThemeSides,
  options: {
    page: number;
    limit: number;
    /** Loads the quote (and its relations) behind each ranked link row of the page, keeping the order. */
    hydrate: (rows: ReadingRow[]) => Promise<unknown[]>;
    /** The service's own item mapper; rows are the ranked link rows with `quote` loaded. */
    present: (row: unknown) => TItem;
  },
): Promise<{ items: TItem[]; total: number; countsByType: Record<string, number> }> {
  const [sinRanked, deedRanked] = await Promise.all([
    sides.sin ? prisma.sinQuote.findMany({ where: sides.sin, select: READING_SELECT }) : Promise.resolve([]),
    sides.deed ? prisma.goodDeedQuote.findMany({ where: sides.deed, select: READING_SELECT }) : Promise.resolve([]),
  ]);
  const merged = dedupeReading([...sinRanked, ...deedRanked] as ReadingRow[]);
  const countsByType: Record<string, number> = { QURAN_VERSE: 0, HADITH: 0, SCHOLAR_QUOTE: 0, BOOK_EXCERPT: 0 };
  for (const row of merged) countsByType[row.quote.type] = (countsByType[row.quote.type] ?? 0) + 1;
  const pageRows = merged.slice((options.page - 1) * options.limit, options.page * options.limit);
  const full = await options.hydrate(pageRows);
  return {
    items: full.map((row) => options.present(row)),
    total: merged.length,
    countsByType,
  };
}
