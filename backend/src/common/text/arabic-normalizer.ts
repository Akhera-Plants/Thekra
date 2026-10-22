/**
 * Normalises Arabic for search: strip tashkeel/tatweel, fold alef/ya/ta-marbuta variants.
 * Apply to both the query and candidate text before matching.
 *
 * Rules (kept in sync with the `thekra_normalize_ar` SQL function — see
 * backend-plan §4.4 Phase 5 for the planned trigram index on that function):
 *  1. Strip tashkeel U+064B–U+0652, superscript alef U+0670, extended marks U+06D6–U+06ED
 *  2. Strip tatweel U+0640
 *  3. Fold أ إ آ ٱ (U+0623 U+0625 U+0622 U+0671) → ا
 *  4. Fold ى (U+0649) → ي
 *  5. Fold ة (U+0629) → ه
 */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // أإآٱ → ا
    .replace(/\u0649/g, '\u064A') // ى → ي
    .replace(/\u0629/g, '\u0647'); // ة → ه
}

/**
 * Escapes ILIKE special characters (`%`, `_`, `\`) in a query string so that
 * the value is treated as a literal substring.
 *
 * Use before embedding user input into a `ILIKE '%' || $1 || '%'` clause.
 */
export function escapeIlikePattern(q: string): string {
  return q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
