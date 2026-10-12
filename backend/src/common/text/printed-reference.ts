export interface PrintedReference {
  referenceNumber: number | null;
  referenceLabel: string | null;
}

/** Pulls a printed number, and an optional mark, out of a legacy reference string. */
export function parsePrintedReference(value: string | null | undefined): PrintedReference {
  if (!value) return { referenceNumber: null, referenceLabel: null };
  const slash = value.match(/(\d+\/\d+)\s*$/);
  if (slash?.[1]) return { referenceNumber: null, referenceLabel: slash[1] };
  const match = value.match(/(\d+)\s*(?:\(([^)]+)\))?\s*$/);
  if (!match?.[1]) return { referenceNumber: null, referenceLabel: null };
  return {
    referenceNumber: Number(match[1]),
    referenceLabel: match[2] ?? null,
  };
}

export function utcDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

/**
 * Locale citation. Arabic uses the source's Arabic name.
 * Digits stay Western here; the client draws Arabic-Indic numerals.
 */
export function formatPrintedReference(input: {
  locale: 'ar' | 'en';
  workAr: string | null;
  workEn: string;
  referenceNumber: number | null;
  referenceLabel: string | null;
}): string | null {
  const work = input.locale === 'ar' ? input.workAr : input.workEn;
  if (!work) return null;
  if (input.locale === 'ar' && /[A-Za-z]/.test(work)) return null;
  const { referenceNumber, referenceLabel } = input;
  if (referenceNumber == null && !referenceLabel) return null;
  if (referenceNumber == null) {
    return input.locale === 'ar' ? `${work}، ${referenceLabel}` : `${work} ${referenceLabel}`;
  }
  const mark = referenceLabel ? ` (${referenceLabel})` : '';
  return input.locale === 'ar'
    ? `${work}، رقم ${referenceNumber}${mark}`
    : `${work} ${referenceNumber}${mark}`;
}
