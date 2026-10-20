/**
 * Every enum the admin desk shows, in one place, per locale.
 * Arabic is the working language of the desk: no raw enum value (HADITH, LOCAL, UNGRADED…)
 * should ever reach an `ar` screen. `satisfies` makes a new enum member a compile error here.
 */
import type {
  HadithGrade,
  LinkReviewStatus,
  QuoteOrigin,
  QuoteType,
  SourceType,
  SyncStatus,
  TagCategory,
} from '@/lib/types/enums';

type Locale = 'ar' | 'en';
type LabelTable<K extends string> = Record<K, { ar: string; en: string }>;

export type FlagType =
  | 'WEAK_MATCH'
  | 'DUPLICATE_DIFFERENT_GRADE'
  | 'QURAN_MISMATCH'
  | 'OCR_SUSPECT'
  | 'REFERENCE_MISMATCH'
  | 'USER_REPORT'
  | 'AMBIGUOUS_CHAPTER'
  | 'WEAK_TAFSIR_SUPPORT'
  | 'OUTSIDE_SAHIHAYN';
export type FlagSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type FlagStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';
export type MatchDecision = 'CANDIDATE' | 'CONFIRMED' | 'REJECTED';
export type ClassifiedBy = 'BOOK' | 'REVIEWER' | 'AI';
export type LinkBasis =
  | 'CHAPTER'
  | 'CHAPTER_AYAH'
  | 'TAKHRIJ'
  | 'AUTHOR_CITATION'
  | 'REVIEWER_SECTION'
  | 'AI_ITEM'
  | 'KEYWORD_PROPOSAL'
  | 'MANUAL';
export type TextSource = 'DIGITAL' | 'OCR' | 'MANUAL';
export type GradeSource =
  | 'AUTHORITY_LEGACY'
  | 'AUTO_SAHIHAYN'
  | 'SAHIHAYN'
  | 'MANUAL'
  | 'SUNAN_TAHQIQ'
  | 'IBN_RAJAB'
  | 'HADEETHENC';
export type ReferenceBook = 'BUKHARI' | 'MUSLIM';
export type PublishReason =
  | 'OCR_UNVERIFIED'
  | 'HIGH_FLAG'
  | 'NO_GRADE'
  | 'MAWDU'
  | 'UNAPPROVED_GRADE_SOURCE'
  | 'UNKNOWN';

/** Grade sources the reader policy accepts for hadith (backend grade-policy.ts). */
export const APPROVED_GRADE_SOURCES = [
  'SAHIHAYN',
  'AUTO_SAHIHAYN',
  'MANUAL',
  'SUNAN_TAHQIQ',
  'HADEETHENC',
] as const;

export const FLAG_TYPES: FlagType[] = [
  'WEAK_MATCH',
  'DUPLICATE_DIFFERENT_GRADE',
  'QURAN_MISMATCH',
  'OCR_SUSPECT',
  'REFERENCE_MISMATCH',
  'USER_REPORT',
  'AMBIGUOUS_CHAPTER',
  'WEAK_TAFSIR_SUPPORT',
  'OUTSIDE_SAHIHAYN',
];
export const FLAG_SEVERITIES: FlagSeverity[] = ['HIGH', 'MEDIUM', 'LOW'];
export const FLAG_STATUSES: FlagStatus[] = ['OPEN', 'RESOLVED', 'DISMISSED'];

const TABLES = {
  quoteType: {
    QURAN_VERSE: { ar: 'آية', en: 'Verse' },
    HADITH: { ar: 'حديث', en: 'Hadith' },
    SCHOLAR_QUOTE: { ar: 'قول عالم', en: 'Scholar quote' },
    BOOK_EXCERPT: { ar: 'مقتطف كتاب', en: 'Book excerpt' },
  } satisfies LabelTable<QuoteType>,
  origin: {
    LOCAL: { ar: 'مُدخَل', en: 'Local' },
    API_CACHED: { ar: 'مُستورد من واجهة', en: 'API cached' },
  } satisfies LabelTable<QuoteOrigin>,
  grade: {
    SAHIH: { ar: 'صحيح', en: 'Sahih' },
    HASAN: { ar: 'حسن', en: 'Hasan' },
    DAIF: { ar: 'ضعيف', en: "Da'if" },
    MAWDU: { ar: 'موضوع', en: "Mawdu'" },
    UNGRADED: { ar: 'بلا حكم', en: 'Ungraded' },
  } satisfies LabelTable<HadithGrade>,
  flagType: {
    WEAK_MATCH: { ar: 'مطابقة غير محسومة', en: 'Unsettled match' },
    DUPLICATE_DIFFERENT_GRADE: { ar: 'مكرر بحكم مختلف', en: 'Duplicate, different grade' },
    QURAN_MISMATCH: { ar: 'آية غير مطابقة', en: 'Verse mismatch' },
    OCR_SUSPECT: { ar: 'نص مسح مشكوك', en: 'Suspect OCR text' },
    REFERENCE_MISMATCH: { ar: 'رقم غير مطابق', en: 'Reference mismatch' },
    USER_REPORT: { ar: 'بلاغ قارئ', en: 'Reader report' },
    AMBIGUOUS_CHAPTER: { ar: 'باب ملتبس', en: 'Ambiguous chapter' },
    WEAK_TAFSIR_SUPPORT: { ar: 'سند تفسيري ضعيف', en: 'Weak tafsir support' },
    OUTSIDE_SAHIHAYN: { ar: 'خارج الصحيحين', en: 'Outside the Sahihayn' },
  } satisfies LabelTable<FlagType>,
  severity: {
    HIGH: { ar: 'عالية', en: 'High' },
    MEDIUM: { ar: 'متوسطة', en: 'Medium' },
    LOW: { ar: 'منخفضة', en: 'Low' },
  } satisfies LabelTable<FlagSeverity>,
  flagStatus: {
    OPEN: { ar: 'مفتوح', en: 'Open' },
    RESOLVED: { ar: 'محلول', en: 'Resolved' },
    DISMISSED: { ar: 'مُتجاهَل', en: 'Dismissed' },
  } satisfies LabelTable<FlagStatus>,
  decision: {
    CANDIDATE: { ar: 'مرشحة', en: 'Candidate' },
    CONFIRMED: { ar: 'مؤكدة', en: 'Confirmed' },
    REJECTED: { ar: 'مرفوضة', en: 'Rejected' },
  } satisfies LabelTable<MatchDecision>,
  referenceBook: {
    BUKHARI: { ar: 'البخاري', en: 'al-Bukhari' },
    MUSLIM: { ar: 'مسلم', en: 'Muslim' },
  } satisfies LabelTable<ReferenceBook>,
  syncStatus: {
    PENDING: { ar: 'في الانتظار', en: 'Pending' },
    RUNNING: { ar: 'يعمل', en: 'Running' },
    SUCCESS: { ar: 'نجحت', en: 'Succeeded' },
    FAILED: { ar: 'فشلت', en: 'Failed' },
  } satisfies LabelTable<SyncStatus>,
  sourceType: {
    QURAN: { ar: 'القرآن', en: "Qur'an" },
    HADITH_COLLECTION: { ar: 'كتاب حديث', en: 'Hadith collection' },
    BOOK: { ar: 'كتاب', en: 'Book' },
    SCHOLAR: { ar: 'عالم', en: 'Scholar' },
    OTHER: { ar: 'أخرى', en: 'Other' },
  } satisfies LabelTable<SourceType>,
  tagCategory: {
    SIN: { ar: 'معصية', en: 'Sin' },
    GOOD_DEED: { ar: 'طاعة', en: 'Good deed' },
    THEME: { ar: 'موضوع', en: 'Theme' },
    EMOTION: { ar: 'حال القلب', en: 'Emotion' },
  } satisfies LabelTable<TagCategory>,
  reviewStatus: {
    NOT_REVIEWED: { ar: 'لم يُراجَع', en: 'Not reviewed' },
    UNDER_REVIEW: { ar: 'قيد المراجعة', en: 'Under review' },
    REVIEWED: { ar: 'رُوجع', en: 'Reviewed' },
    ACCEPTED: { ar: 'مقبول', en: 'Accepted' },
    REJECTED: { ar: 'مرفوض', en: 'Rejected' },
  } satisfies LabelTable<LinkReviewStatus>,
  classifiedBy: {
    BOOK: { ar: 'الكتاب', en: 'Book' },
    REVIEWER: { ar: 'المراجِع', en: 'Reviewer' },
    AI: { ar: 'الآلة', en: 'Machine' },
  } satisfies LabelTable<ClassifiedBy>,
  basis: {
    CHAPTER: { ar: 'عنوان الباب', en: 'Chapter title' },
    CHAPTER_AYAH: { ar: 'آية الباب', en: 'Chapter verse' },
    TAKHRIJ: { ar: 'التخريج', en: 'Takhrij' },
    AUTHOR_CITATION: { ar: 'إيراد المؤلف', en: 'Author citation' },
    REVIEWER_SECTION: { ar: 'قسم المراجِع', en: 'Reviewer section' },
    AI_ITEM: { ar: 'اقتراح آلي', en: 'Machine item' },
    KEYWORD_PROPOSAL: { ar: 'اقتراح بالكلمات', en: 'Keyword proposal' },
    MANUAL: { ar: 'يدوي', en: 'Manual' },
  } satisfies LabelTable<LinkBasis>,
  gradeSource: {
    AUTHORITY_LEGACY: { ar: 'حكم قديم من الكتاب', en: 'Legacy book grade' },
    AUTO_SAHIHAYN: { ar: 'مطابقة آلية للصحيحين', en: 'Auto Sahihayn match' },
    SAHIHAYN: { ar: 'الصحيحان', en: 'Sahihayn' },
    MANUAL: { ar: 'حكم المراجِع', en: 'Reviewer grade' },
    SUNAN_TAHQIQ: { ar: 'تحقيق الأرنؤوط', en: "Arna'ut tahqiq" },
    IBN_RAJAB: { ar: 'ابن رجب', en: 'Ibn Rajab' },
    HADEETHENC: { ar: 'موسوعة الأحاديث النبوية', en: 'Hadeeth Encyclopedia' },
  } satisfies LabelTable<GradeSource>,
  textSource: {
    DIGITAL: { ar: 'رقمي', en: 'Digital' },
    OCR: { ar: 'مسح ضوئي', en: 'OCR' },
    MANUAL: { ar: 'يدوي', en: 'Manual' },
  } satisfies LabelTable<TextSource>,
  publishReason: {
    OCR_UNVERIFIED: { ar: 'نص مسح ضوئي غير مُراجَع', en: 'Unreviewed OCR text' },
    HIGH_FLAG: { ar: 'علامة عالية', en: 'High-severity flag' },
    NO_GRADE: { ar: 'لا حكم', en: 'No grade' },
    MAWDU: { ar: 'موضوع لا يُنشر', en: 'Fabricated — never published' },
    UNAPPROVED_GRADE_SOURCE: { ar: 'مرجع الحكم غير معتمد للنشر', en: 'Grade source not approved for publishing' },
    UNKNOWN: { ar: 'حكم من مرجع غير معتمد أو علامة عالية', en: 'Unapproved grade source or high flag' },
  } satisfies LabelTable<PublishReason>,
} as const;

export type LabelKind = keyof typeof TABLES;

/** Arabic (or English) word for an enum value. Unknown values fall back to the raw value. */
export function adminLabel<K extends LabelKind>(
  kind: K,
  value: string | null | undefined,
  locale: string,
): string {
  if (!value) return '—';
  const table = TABLES[kind] as Record<string, { ar: string; en: string }>;
  const entry = table[value];
  if (!entry) return value;
  return entry[(locale === 'en' ? 'en' : 'ar') satisfies Locale];
}

/** All values of a label table, in declaration order. */
export function labelKeys<K extends LabelKind>(kind: K): string[] {
  return Object.keys(TABLES[kind]);
}

/** Source.nameAr in Arabic, Source.name in English; never the other language as a subtitle. */
export function sourceName(
  source: { name: string; nameAr: string | null } | null | undefined,
  locale: string,
): string {
  if (!source) return '—';
  if (locale === 'en') return source.name;
  return source.nameAr ?? source.name;
}

/** Topic (sin / good deed / tag) name for the active locale. */
export function topicName(
  topic: { name?: string | null; nameAr?: string | null } | null | undefined,
  locale: string,
): string {
  if (!topic) return '—';
  if (locale === 'en') return topic.name ?? topic.nameAr ?? '—';
  return topic.nameAr ?? topic.name ?? '—';
}
