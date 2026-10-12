const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

/** Maps Latin digits when `arabic` is set. One helper for every count, rank, and reference. */
export function formatDigits(value: string | number, arabic: boolean): string {
  const text = String(value);
  if (!arabic) return text;
  return text.replace(/\d/g, (digit) => ARABIC_INDIC[Number(digit)] ?? digit);
}
