export type StudyTabId =
  | 'mukhtasar'
  | 'sadi'
  | 'ashur'
  | 'sharh'
  | 'fawaid'
  | 'gharib'
  | 'fath'
  | 'nawawi';

export interface ExplanationRow {
  id: string;
  kind: string;
  languageCode: string;
  text: string;
  reference: string | null;
  source: { name: string; nameAr: string | null };
}

function sourceMatches(row: ExplanationRow, needles: RegExp): boolean {
  return needles.test(row.source.name) || needles.test(row.source.nameAr ?? '');
}

export function pickTabRows(
  rows: ExplanationRow[],
  tab: StudyTabId,
  locale: string,
): ExplanationRow[] {
  const langFilter = (row: ExplanationRow) =>
    locale === 'en' ? row.languageCode === 'en' : row.languageCode === 'ar' || row.languageCode === locale;

  const base = rows.filter(langFilter);

  switch (tab) {
    case 'mukhtasar':
      return base.filter(
        (row) => row.kind === 'TAFSIR' && sourceMatches(row, /mukhtasar|مختصر/i),
      );
    case 'sadi':
      return base.filter(
        (row) => row.kind === 'TAFSIR' && sourceMatches(row, /sa'?di|سعدي/i),
      );
    case 'ashur':
      return base.filter(
        (row) => row.kind === 'TAFSIR' && sourceMatches(row, /tahrir|تحرير|عاشور|ashur/i),
      );
    case 'sharh':
      return base.filter(
        (row) => row.kind === 'SHARH' && sourceMatches(row, /hadeethenc|موسوعة الأحاديث|hadith encyclopedia/i),
      );
    case 'fawaid':
      return base.filter((row) => row.kind === 'FAWAID');
    case 'gharib':
      return base.filter((row) => row.kind === 'GHARIB');
    case 'fath':
      return base.filter(
        (row) => row.kind === 'SHARH_LONG' && sourceMatches(row, /fath|فتح الباري|hajar/i),
      );
    case 'nawawi':
      return base.filter(
        (row) => row.kind === 'SHARH_LONG' && sourceMatches(row, /nawawi|نووي|minhaj/i),
      );
    default:
      return [];
  }
}

export function verseTabsForLocale(locale: string): StudyTabId[] {
  return locale === 'en' ? ['mukhtasar'] : ['mukhtasar', 'sadi', 'ashur'];
}

export function hadithTabsForLocale(locale: string): StudyTabId[] {
  return locale === 'en'
    ? ['sharh', 'fawaid', 'gharib']
    : ['sharh', 'fawaid', 'gharib', 'fath', 'nawawi'];
}

export const LONG_PREVIEW_CHARS = 1200;
