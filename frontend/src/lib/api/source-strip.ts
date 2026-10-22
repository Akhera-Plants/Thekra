import { env } from '@/lib/env';
import { z } from '@/lib/zod';
import type { LocaleCode } from '@/lib/types/enums';

/**
 * Names for the home «تذكير تعرف مصدره» strip. Only sources with published
 * texts are listed, ordered by published count. The list is read with native
 * fetch, not the axios client: axios bypasses Next's data cache, and the home
 * page is force-dynamic, which makes every fetch uncached unless it is native.
 */

/** Used only when the API cannot answer. Each of these has published texts. */
const FALLBACK_NAMES: Record<LocaleCode, readonly string[]> = {
  ar: ['القرآن الكريم', 'صحيح البخاري', 'صحيح مسلم', 'رياض الصالحين'],
  en: ['The Noble Quran', 'Sahih al-Bukhari', 'Sahih Muslim', 'Riyad as-Salihin'],
};

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const REVALIDATE_SECONDS = 3600;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_LABEL_LENGTH = 80;

// zod strips every field not listed here, so only the name and count leave the API.
const sourcePageSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      nameAr: z.string().nullable(),
      publishedQuoteCount: z.number().int().nonnegative(),
    }),
  ),
  meta: z.object({ hasNext: z.boolean() }),
});

type SourcePage = z.infer<typeof sourcePageSchema>;
type SourceRow = SourcePage['data'][number];

async function fetchSourcePage(page: number): Promise<SourcePage> {
  const url = new URL(`${env.NEXT_PUBLIC_API_URL}/v1/sources`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(PAGE_SIZE));
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GET /v1/sources responded ${response.status}`);
  }
  return sourcePageSchema.parse(await response.json());
}

function cleanLabel(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
}

/**
 * Published sources, most published first, one entry per name. Each locale
 * uses only its own name field: a missing Arabic name is skipped rather than
 * shown in Latin on the Arabic page (and the reverse for English).
 */
export function rankSourceNames(rows: readonly SourceRow[], locale: LocaleCode): string[] {
  const ranked = rows
    .filter((row) => row.publishedQuoteCount > 0)
    .map((row) => ({
      label: locale === 'en' ? cleanLabel(row.name) : cleanLabel(row.nameAr),
      count: row.publishedQuoteCount,
    }))
    .filter((row) => row.label.length > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale));

  const seen = new Set<string>();
  const names: string[] = [];
  for (const { label } of ranked) {
    if (seen.has(label)) continue;
    seen.add(label);
    names.push(label);
  }
  return names;
}

/**
 * Names for the strip in the active locale. Never throws: any failure or an
 * empty result returns the static fallback, so the strip always has content.
 */
export async function getSourceStripNames(locale: LocaleCode): Promise<string[]> {
  try {
    const rows: SourceRow[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const batch = await fetchSourcePage(page);
      rows.push(...batch.data);
      if (!batch.meta.hasNext) break;
    }
    const names = rankSourceNames(rows, locale);
    return names.length > 0 ? names : [...FALLBACK_NAMES[locale]];
  } catch {
    return [...FALLBACK_NAMES[locale]];
  }
}
