/**
 * Frontend-owned enum mirrors of the Prisma / API contract.
 * Never import from `@prisma/client` — see frontend-plan.md §6.2.
 */

export const QuoteType = {
  QURAN_VERSE: 'QURAN_VERSE',
  HADITH: 'HADITH',
  SCHOLAR_QUOTE: 'SCHOLAR_QUOTE',
  BOOK_EXCERPT: 'BOOK_EXCERPT',
} as const;
export type QuoteType = (typeof QuoteType)[keyof typeof QuoteType];

export const QuoteOrigin = {
  LOCAL: 'LOCAL',
  API_CACHED: 'API_CACHED',
} as const;
export type QuoteOrigin = (typeof QuoteOrigin)[keyof typeof QuoteOrigin];

export const HadithGrade = {
  SAHIH: 'SAHIH',
  HASAN: 'HASAN',
  DAIF: 'DAIF',
  MAWDU: 'MAWDU',
  UNGRADED: 'UNGRADED',
} as const;
export type HadithGrade = (typeof HadithGrade)[keyof typeof HadithGrade];

export const TagCategory = {
  SIN: 'SIN',
  GOOD_DEED: 'GOOD_DEED',
  THEME: 'THEME',
  EMOTION: 'EMOTION',
} as const;
export type TagCategory = (typeof TagCategory)[keyof typeof TagCategory];

export const SourceType = {
  QURAN: 'QURAN',
  HADITH_COLLECTION: 'HADITH_COLLECTION',
  BOOK: 'BOOK',
  SCHOLAR: 'SCHOLAR',
  OTHER: 'OTHER',
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const SyncStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export type LocaleCode = 'ar' | 'en';
