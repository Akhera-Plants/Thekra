import { GradeSource, Prisma, type HadithGrade, type QuoteOrigin, type QuoteType, type SourceType, type TagCategory, type TextSource } from '@prisma/client';
import { isArnautGradeSource } from '../../modules/hadith/grade-policy.js';
import { STRONG_MATCH_SCORE } from '../text/match-score.js';
import { formatPrintedReference } from '../text/printed-reference.js';

export const sahihaynMatchInclude = {
  where: { decision: { not: 'REJECTED' as const }, score: { gte: STRONG_MATCH_SCORE } },
  orderBy: { score: 'desc' as const },
  take: 1,
  include: { referenceHadith: { select: { matnText: true } } },
} satisfies Prisma.Quote$matchesArgs;

/** Canonical include for every Quote → QuoteDto projection. */
export const quoteIncludeForDto = {
  source: true,
  translations: true,
  tags: { include: { tag: true } },
  matches: sahihaynMatchInclude,
} satisfies Prisma.QuoteInclude;

/** Detail include: same projection plus related sin / good-deed links. */
export const quoteDetailIncludeForDto = {
  source: true,
  translations: true,
  tags: { include: { tag: true } },
  matches: sahihaynMatchInclude,
  sinLinks: {
    include: {
      sin: { select: { slug: true, name: true, nameAr: true } },
    },
  },
  goodDeedLinks: {
    include: {
      goodDeed: {
        select: { slug: true, name: true, nameAr: true },
      },
    },
  },
} satisfies Prisma.QuoteInclude;

export type QuoteRowForDto = Prisma.QuoteGetPayload<{
  include: typeof quoteIncludeForDto;
}>;

export type QuoteDetailRowForDto = Prisma.QuoteGetPayload<{
  include: typeof quoteDetailIncludeForDto;
}>;

export interface QuoteSourceDto {
  id: string;
  name: string;
  nameAr: string | null;
  type: SourceType;
  author: string | null;
  authorAr: string | null;
  isExternalApi: boolean;
  apiProvider: string | null;
}

export interface QuoteTagDto {
  id: string;
  slug: string;
  name: string;
  nameAr: string | null;
  category: TagCategory;
}

export interface QuoteDto {
  id: string;
  type: QuoteType;
  origin: QuoteOrigin;
  textAr: string;
  translation: { languageCode: string; text: string } | null;
  quran: {
    surahNumber: number | null;
    surahName: string | null;
    surahNameAr: string | null;
    ayahNumber: number | null;
  } | null;
  hadith: {
    narrator: string | null;
    narratorAr: string | null;
    grade: HadithGrade | null;
    reference: string | null;
    /** True when the public grade is a sunan tahqiq, not Bukhari or Muslim. */
    outsideSahihayn: boolean;
  } | null;
  book: {
    bookTitle: string | null;
    author: string | null;
    pageOrChapter: string | null;
  } | null;
  /** Printed location in the cited edition. Nulls when the edition has no page. */
  citation: {
    volume: string | null;
    page: string | null;
    gradeAuthority: string | null;
    gradeReference: string | null;
    /** Second provenance line (e.g. Shu'ab when the matn is a Sahihayn match). */
    alsoIn: string | null;
  };
  source: QuoteSourceDto;
  tags: QuoteTagDto[];
  textSource: TextSource;
  textVerifiedAt: Date | null;
  /** Athar (Companion/Successor saying). Never mixed with hadith grades. */
  isAthar: boolean;
  atharSpeakerKey: string | null;
  atharSpeakerAr: string | null;
  /** Clean story (no chain). Null when the row is not a kept athar. */
  atharTextAr: string | null;
  atharAttributionKind: 'SAID' | 'NARRATED' | null;
  external: { apiProvider: string | null; externalId: string | null } | null;
  isFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function publicTextAr(row: QuoteRowForDto): string {
  if (row.isAthar && row.atharTextAr && row.atharTextAr.trim().length > 0) {
    return row.atharTextAr.trim();
  }
  if (row.gradeSource === GradeSource.AUTO_SAHIHAYN) {
    return row.matches[0]?.referenceHadith.matnText.trim() || row.matnAr || row.textAr;
  }
  // Shu'ab (and any row with a stored matn): never show the chain publicly.
  if (row.matnAr && row.matnAr.trim().length > 0) return row.matnAr.trim();
  return row.textAr;
}

function shuabAlsoIn(row: QuoteRowForDto, locale: 'ar' | 'en'): string | null {
  if (row.apiProvider !== 'book:shuab-iman') return null;
  if (
    row.gradeSource !== GradeSource.AUTO_SAHIHAYN &&
    !isArnautGradeSource(row.gradeSource) &&
    row.gradeSource !== GradeSource.HADEETHENC
  ) {
    return null;
  }
  const number = row.referenceNumber;
  if (locale === 'en') {
    return number == null
      ? "Also in Bayhaqi's Shu'ab al-Iman"
      : `Also in Bayhaqi's Shu'ab al-Iman, no. ${number}`;
  }
  return number == null
    ? 'ورد في الجامع لشعب الإيمان للبيهقي'
    : `ورد في الجامع لشعب الإيمان للبيهقي، رقم ${number}`;
}

export function mapQuoteToDto(
  row: QuoteRowForDto,
  locale: 'ar' | 'en',
): QuoteDto {
  const translation =
    locale === 'ar'
      ? null
      : (row.translations.find((t) => t.languageCode === locale) ?? null);

  return {
    id: row.id,
    type: row.type,
    origin: row.origin,
    textAr: publicTextAr(row),
    translation: translation
      ? { languageCode: translation.languageCode, text: translation.text }
      : null,
    quran:
      row.type === 'QURAN_VERSE'
        ? {
            surahNumber: row.surahNumber,
            surahName: row.surahName,
            surahNameAr: row.surahNameAr,
            ayahNumber: row.ayahNumber,
          }
        : null,
    hadith:
      row.type === 'HADITH'
        ? {
            narrator: row.narrator,
            narratorAr: row.narratorAr,
            // Athar never carry a hadith grade on the public card.
            grade: row.isAthar ? null : row.grade,
            reference: formatPrintedReference({
              locale,
              workAr: row.source.nameAr,
              workEn: row.source.name,
              referenceNumber: row.referenceNumber,
              referenceLabel: row.referenceLabel,
            }),
            outsideSahihayn: isArnautGradeSource(row.gradeSource),
          }
        : null,
    book:
      row.type === 'BOOK_EXCERPT' || row.type === 'SCHOLAR_QUOTE'
        ? {
            bookTitle: row.bookTitle,
            author: row.author,
            pageOrChapter: row.pageOrChapter,
          }
        : null,
    citation: {
      volume: row.volume,
      page: row.page,
      gradeAuthority: row.isAthar ? null : row.gradeAuthority,
      gradeReference: row.isAthar ? null : row.gradeReference,
      alsoIn: shuabAlsoIn(row, locale),
    },
    source: {
      id: row.source.id,
      name: row.source.name,
      nameAr: row.source.nameAr,
      type: row.source.type,
      author: row.source.author,
      authorAr: row.source.authorAr,
      isExternalApi: row.source.isExternalApi,
      apiProvider: row.source.apiProvider,
    },
    tags: row.tags.map(({ tag }) => ({
      id: tag.id,
      slug: tag.slug,
      name: tag.name,
      nameAr: tag.nameAr,
      category: tag.category,
    })),
    textSource: row.textSource,
    textVerifiedAt: row.textVerifiedAt,
    isAthar: row.isAthar,
    atharSpeakerKey: row.atharSpeakerKey,
    atharSpeakerAr: row.atharSpeakerAr,
    atharTextAr: row.atharTextAr,
    atharAttributionKind: row.atharAttributionKind,
    external:
      row.origin === 'API_CACHED'
        ? { apiProvider: row.apiProvider, externalId: row.externalId }
        : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
