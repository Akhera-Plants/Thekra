import { QuoteType, type Prisma } from '@prisma/client';
import { dedupeReading, READING_SELECT, type ReadingRow } from '../classification/reading.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TopicTheme } from './topic-themes.js';

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

export interface KindCounts {
  all: number;
  verse: number;
  hadith: number;
  athar: number;
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

/**
 * `meta.themes` (every theme of the page, in file order, with its distinct
 * text count) and, for the active theme, the kind counts of its texts.
 * `sides` carry the reader filter without a kind, so counts do not move with the tab.
 */
export async function summariseThemes(
  prisma: PrismaService,
  sides: ThemeSides,
  themes: readonly TopicTheme[],
  active: string | null,
): Promise<{ themes: ThemeCount[]; countsByKind: KindCounts | null }> {
  if (themes.length === 0) return { themes: [], countsByKind: null };
  const keys = themes.map((theme) => theme.key);
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
      if (!(row.themeKeys ?? []).includes(active) || seen.has(row.quoteId)) continue;
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
      count: quotesByKey.get(theme.key)?.size ?? 0,
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
    include: Prisma.QuoteInclude;
    /** The service's own item mapper; rows are link rows with `quote` loaded by `include`. */
    present: (row: unknown) => TItem;
  },
): Promise<{ items: TItem[]; total: number; countsByType: Record<string, number> }> {
  const [sinRanked, deedRanked] = await Promise.all([
    sides.sin ? prisma.sinQuote.findMany({ where: sides.sin, select: READING_SELECT }) : Promise.resolve([]),
    sides.deed ? prisma.goodDeedQuote.findMany({ where: sides.deed, select: READING_SELECT }) : Promise.resolve([]),
  ]);
  const sinIds = new Set(sinRanked.map((row) => row.id));
  const merged = dedupeReading([...sinRanked, ...deedRanked] as ReadingRow[]);
  const countsByType: Record<string, number> = { QURAN_VERSE: 0, HADITH: 0, SCHOLAR_QUOTE: 0, BOOK_EXCERPT: 0 };
  for (const row of merged) countsByType[row.quote.type] = (countsByType[row.quote.type] ?? 0) + 1;
  const pageRows = merged.slice((options.page - 1) * options.limit, options.page * options.limit);
  const sinPage = pageRows.filter((row) => sinIds.has(row.id)).map((row) => row.id);
  const deedPage = pageRows.filter((row) => !sinIds.has(row.id)).map((row) => row.id);
  const [sinFull, deedFull] = await Promise.all([
    sinPage.length > 0
      ? prisma.sinQuote.findMany({ where: { id: { in: sinPage } }, include: { quote: { include: options.include } } })
      : Promise.resolve([]),
    deedPage.length > 0
      ? prisma.goodDeedQuote.findMany({ where: { id: { in: deedPage } }, include: { quote: { include: options.include } } })
      : Promise.resolve([]),
  ]);
  const order = new Map(pageRows.map((row, index) => [row.id, index]));
  const full = [...sinFull, ...deedFull].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return {
    items: full.map((row) => options.present(row)),
    total: merged.length,
    countsByType,
  };
}
