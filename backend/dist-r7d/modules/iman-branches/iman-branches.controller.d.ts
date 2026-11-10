import { type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { SinQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import { BranchesQueryDto } from './dto/branches-query.dto.js';
import { ImanBranchesService } from './iman-branches.service.js';
export declare class ImanBranchesController {
    private readonly branches;
    private readonly favorites;
    constructor(branches: ImanBranchesService, favorites: FavoritesService);
    findAll(query: BranchesQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<{
        id: string;
        number: number;
        titleAr: string;
        title: string | null;
        summaryAr: string | null;
        summary: string | null;
        quoteCount: number;
        source: {
            id: string;
            name: string;
            nameAr: string | null;
        } | null;
        sourceReference: string | null;
    }>>;
    findOne(number: number, query: BranchesQueryDto): Promise<{
        data: {
            mizan: import("../quotes/quotes.service.js").MizanDto | null;
            explanations: {
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
            goodDeeds: {
                name: string;
                slug: string;
                nameAr: string;
            }[];
            sins: {
                name: string;
                slug: string;
                nameAr: string;
                rank: import("@prisma/client").$Enums.SinRank | null;
            }[];
            prev: {
                number: number;
                title: string | null;
                titleAr: string;
            } | null;
            next: {
                number: number;
                title: string | null;
                titleAr: string;
            } | null;
            id: string;
            number: number;
            titleAr: string;
            title: string | null;
            summaryAr: string | null;
            summary: string | null;
            quoteCount: number;
            source: {
                id: string;
                name: string;
                nameAr: string | null;
            } | null;
            sourceReference: string | null;
        };
    }>;
    findQuotes(number: number, query: SinQuotesQueryDto, user: JwtPayload | undefined): Promise<{
        data: {
            branch: {
                number: number;
                titleAr: string;
                title: string | null;
                summaryAr: string | null;
            };
            items: {
                link: {
                    id: string;
                    relevanceScore: number | null;
                    note: string | null;
                };
                quote: import("../quotes/entities/quote.entity.js").QuoteDto;
            }[];
        };
        meta: import("../../common/dto/paginated-result.js").PageMeta;
    }>;
}
