import { type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { QuoteDetailQueryDto } from './dto/quote-detail-query.dto.js';
import { ReportQuoteDto } from './dto/report-quote.dto.js';
import { QuotesQueryDto } from './dto/quotes-query.dto.js';
import { QuoteReaderQueryDto } from './dto/quote-reader-query.dto.js';
import { QuoteReaderService } from './quote-reader.service.js';
import { QuoteReportsService } from './quote-reports.service.js';
import { QuotesService } from './quotes.service.js';
export declare class QuotesController {
    private readonly quotesService;
    private readonly favoritesService;
    private readonly reports;
    private readonly reader;
    constructor(quotesService: QuotesService, favoritesService: FavoritesService, reports: QuoteReportsService, reader: QuoteReaderService);
    search(query: QuotesQueryDto, user: JwtPayload | undefined): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("./entities/quote.entity.js").QuoteDto> | {
        data: {
            isFavorite: boolean;
            id: string;
        }[];
        meta: import("../../common/dto/paginated-result.js").PageMeta;
    }>;
    reminderOfTheDay(query: QuoteDetailQueryDto): Promise<{
        data: import("./entities/quote.entity.js").QuoteDto | null;
    }>;
    report(id: string, dto: ReportQuoteDto, user: JwtPayload | undefined, ip: string | undefined): Promise<{
        data: {
            accepted: true;
        };
    }>;
    listExplanations(id: string, query: QuoteDetailQueryDto): Promise<{
        data: {
            id: string;
            kind: import("@prisma/client").$Enums.ExplanationKind;
            languageCode: string;
            text: string;
            reference: string | null;
            origin: import("@prisma/client").$Enums.QuoteOrigin;
            source: {
                id: string;
                name: string;
                type: import("@prisma/client").$Enums.SourceType;
                author: string | null;
                nameAr: string | null;
                authorAr: string | null;
            };
        }[];
    }>;
    readerContent(id: string, query: QuoteReaderQueryDto): Promise<{
        data: import("./quote-reader.service.js").QuoteReaderDto;
    }>;
    findById(id: string, query: QuoteDetailQueryDto, user: JwtPayload | undefined): Promise<import("./entities/quote.entity.js").QuoteDto & {
        translations?: {
            id: string;
            languageCode: string;
            text: string;
        }[] | undefined;
        relatedSins?: {
            slug: string;
            name: string;
            nameAr: string;
            relevanceScore: number | null;
        }[] | undefined;
        relatedGoodDeeds?: {
            slug: string;
            name: string;
            nameAr: string;
            relevanceScore: number | null;
        }[] | undefined;
    }>;
}
