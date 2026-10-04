/**
 * Normalises Arabic for search: strip tashkeel/tatweel, fold alef/ya/ta-marbuta variants.
 * Apply to both the query and candidate text before matching.
 */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}
