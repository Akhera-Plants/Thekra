import type {
  HadithGrade,
  QuoteOrigin,
  QuoteType,
  SourceType,
  TagCategory,
} from '@prisma/client';

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
  nameAr: string;
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
  } | null;
  book: {
    bookTitle: string | null;
    author: string | null;
    pageOrChapter: string | null;
  } | null;
  source: QuoteSourceDto;
  tags: QuoteTagDto[];
  external: { apiProvider: string | null; externalId: string | null } | null;
  isFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type QuoteRowForDto = {
  id: string;
  type: QuoteType;
  origin: QuoteOrigin;
  textAr: string;
  surahNumber: number | null;
  surahName: string | null;
  surahNameAr: string | null;
  ayahNumber: number | null;
  narrator: string | null;
  narratorAr: string | null;
  grade: HadithGrade | null;
  hadithReference: string | null;
  bookTitle: string | null;
  author: string | null;
  pageOrChapter: string | null;
  externalId: string | null;
  apiProvider: string | null;
  createdAt: Date;
  updatedAt: Date;
  source: {
    id: string;
    name: string;
    nameAr: string | null;
    type: SourceType;
    author: string | null;
    authorAr: string | null;
    isExternalApi: boolean;
    apiProvider: string | null;
  };
  translations: Array<{ languageCode: string; text: string }>;
  tags: Array<{
    tag: {
      id: string;
      slug: string;
      name: string;
      nameAr: string;
      category: TagCategory;
    };
  }>;
};

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
    textAr: row.textAr,
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
            grade: row.grade,
            reference: row.hadithReference,
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
    external:
      row.origin === 'API_CACHED'
        ? { apiProvider: row.apiProvider, externalId: row.externalId }
        : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
