const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

/**
 * Western digits only (0–9), in both locales.
 * Also folds Arabic-Indic digits that may already sit in stored strings.
 */
export function formatDigits(value: string | number, _arabic = false): string {
  return String(value).replace(/[0-9٠-٩]/g, (digit) => {
    const index = ARABIC_INDIC.indexOf(digit);
    return index >= 0 ? String(index) : digit;
  });
}
