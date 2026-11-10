import type { Response } from 'express';
import { type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { AddFavoriteDto } from './dto/add-favorite.dto.js';
import { FavoritesQueryDto } from './dto/favorites-query.dto.js';
import { FavoritesService } from './favorites.service.js';
export declare class FavoritesController {
    private readonly favoritesService;
    constructor(favoritesService: FavoritesService);
    list(user: JwtPayload, query: FavoritesQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<{
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
            source: import("../quotes/entities/quote.entity.js").QuoteSourceDto;
            tags: import("../quotes/entities/quote.entity.js").QuoteTagDto[];
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
    listQuoteIds(user: JwtPayload): Promise<{
        data: string[];
    }>;
    add(user: JwtPayload, dto: AddFavoriteDto, res: Response): Promise<{
        data: {
            id: string;
            quoteId: string;
            createdAt: Date;
        };
    }>;
    remove(user: JwtPayload, quoteId: string): Promise<void>;
}
