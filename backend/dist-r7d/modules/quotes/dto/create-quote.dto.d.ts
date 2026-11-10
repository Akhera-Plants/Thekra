import { HadithGrade, QuoteOrigin, QuoteType } from '@prisma/client';
export declare class TranslationInputDto {
    languageCode: string;
    text: string;
}
export declare class CreateQuoteDto {
    type: QuoteType;
    origin?: QuoteOrigin;
    textAr: string;
    sourceId: string;
    surahNumber?: number;
    surahName?: string;
    surahNameAr?: string;
    ayahNumber?: number;
    narrator?: string;
    narratorAr?: string;
    grade?: HadithGrade;
    hadithReference?: string;
    referenceNumber?: number;
    referenceLabel?: string;
    bookTitle?: string;
    author?: string;
    pageOrChapter?: string;
    volume?: string;
    page?: string;
    gradeAuthority?: string;
    gradeReference?: string;
    translations?: TranslationInputDto[];
    tagIds?: string[];
}
