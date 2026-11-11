/**
 * «تخفَّف من ذنب» chooser (owner, 2026-11-01): every sin of the public list, grouped by its domain (the same
 * categories as «المعاصي»), filtered by a folded search. Pure, so it is tested without a browser.
 */
import { foldArabic, namesMatch } from '@/lib/search/topic-themes';

export interface SinOption {
  slug: string;
  nameAr: string;
  name?: string | null;
  domainKey?: string | null;
  taxonomyOrder?: number | null;
}

export interface SinChoiceGroup {
  /** The domain key, or null for sins without one (shown last, under «أخرى»). */
  domain: string | null;
  sins: SinOption[];
}

/**
 * Groups in `domainOrder`, then unknown domains, then sins without a domain; inside a group by taxonomy order, then
 * name. The query matches the Arabic or English name, folded on both sides («غض» finds «غضّ»).
 */
export function groupSinsForChooser(sins: readonly SinOption[], query: string, domainOrder: readonly string[]): SinChoiceGroup[] {
  const needle = foldArabic(query.trim());
  const groups = new Map<string | null, SinOption[]>();
  for (const sin of sins) {
    if (!namesMatch([sin.nameAr, sin.name ?? ''], needle)) continue;
    const key = sin.domainKey ?? null;
    const list = groups.get(key) ?? [];
    list.push(sin);
    groups.set(key, list);
  }
  const rank = (key: string | null) => {
    if (key === null) return Number.MAX_SAFE_INTEGER;
    const index = domainOrder.indexOf(key);
    return index === -1 ? domainOrder.length : index;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || String(a).localeCompare(String(b)))
    .map(([domain, list]) => ({
      domain,
      sins: [...list].sort(
        (a, b) => (a.taxonomyOrder ?? 0) - (b.taxonomyOrder ?? 0) || a.nameAr.localeCompare(b.nameAr, 'ar'),
      ),
    }));
}
