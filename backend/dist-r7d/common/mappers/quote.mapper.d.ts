import { Prisma, type HadithGrade, type QuoteOrigin, type QuoteType, type SourceType, type TagCategory, type TextSource } from '@prisma/client';
export declare const sahihaynMatchInclude: {
    where: {
        decision: {
            not: "REJECTED";
        };
        score: {
            gte: number;
        };
    };
    orderBy: {
        score: "desc";
    };
    take: number;
    include: {
        referenceHadith: {
            select: {
                matnText: true;
            };
        };
    };
};
export declare const quoteIncludeForDto: {
    source: true;
    translations: true;
    tags: {
        include: {
            tag: true;
        };
    };
    matches: {
        where: {
            decision: {
                not: "REJECTED";
            };
            score: {
                gte: number;
            };
        };
        orderBy: {
            score: "desc";
        };
        take: number;
        include: {
            referenceHadith: {
                select: {
                    matnText: true;
                };
            };
        };
    };
};
export declare const quoteDetailIncludeForDto: {
    source: true;
    translations: true;
    tags: {
        include: {
            tag: true;
        };
    };
    matches: {
        where: {
            decision: {
                not: "REJECTED";
            };
            score: {
                gte: number;
            };
        };
        orderBy: {
            score: "desc";
        };
        take: number;
        include: {
            referenceHadith: {
                select: {
                    matnText: true;
                };
            };
        };
    };
    sinLinks: {
        include: {
            sin: {
                select: {
                    slug: true;
                    name: true;
                    nameAr: true;
                };
            };
        };
    };
    goodDeedLinks: {
        include: {
            goodDeed: {
                select: {
                    slug: true;
                    name: true;
                    nameAr: true;
                };
            };
        };
    };
};
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
    translation: {
        languageCode: string;
        text: string;
    } | null;
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
        outsideSahihayn: boolean;
    } | null;
    book: {
        bookTitle: string | null;
        author: string | null;
        pageOrChapter: string | null;
    } | null;
    citation: {
        volume: string | null;
        page: string | null;
        gradeAuthority: string | null;
        gradeReference: string | null;
        alsoIn: string | null;
    };
    source: QuoteSourceDto;
    tags: QuoteTagDto[];
    textSource: TextSource;
    textVerifiedAt: Date | null;
    isAthar: boolean;
    atharSpeakerKey: string | null;
    atharSpeakerAr: string | null;
    atharTextAr: string | null;
    atharAttributionKind: 'SAID' | 'NARRATED' | null;
    external: {
        apiProvider: string | null;
        externalId: string | null;
    } | null;
    isFavorite?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare function carriesReferenceMatn(text: string, referenceMatn: string): boolean;
export declare function mapQuoteToDto(row: QuoteRowForDto, locale: 'ar' | 'en'): QuoteDto;
