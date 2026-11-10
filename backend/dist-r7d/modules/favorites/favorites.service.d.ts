import { PrismaService } from '../../prisma/prisma.service.js';
import type { FavoritesQueryDto } from './dto/favorites-query.dto.js';
export declare class FavoritesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(userId: string, query: FavoritesQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<{
        id: string;
        createdAt: Date;
        quote: {
            isFavorite: boolean;
            id: string;
            type: import("@prisma/client").QuoteType;
            origin: import("@prisma/client").QuoteOrigin;
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
                grade: import("@prisma/client").HadithGrade | null;
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
            source: import("../../common/mappers/quote.mapper.js").QuoteSourceDto;
            tags: import("../../common/mappers/quote.mapper.js").QuoteTagDto[];
            textSource: import("@prisma/client").TextSource;
            textVerifiedAt: Date | null;
            isAthar: boolean;
            atharSpeakerKey: string | null;
            atharSpeakerAr: string | null;
            atharTextAr: string | null;
            atharAttributionKind: "SAID" | "NARRATED" | null;
            external: {
                apiProvider: string | null;
                externalId: string | null;
            } | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>>;
    listQuoteIds(userId: string): Promise<string[]>;
    add(userId: string, quoteId: string): Promise<{
        id: string;
        quoteId: string;
        createdAt: Date;
    }>;
    remove(userId: string, quoteId: string): Promise<void>;
}
