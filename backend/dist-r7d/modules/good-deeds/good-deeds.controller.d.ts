import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { GoodDeedQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import { GoodDeedsQueryDto } from './dto/good-deeds-query.dto.js';
import { GoodDeedsService } from './good-deeds.service.js';
export declare class GoodDeedsController {
    private readonly goodDeedsService;
    private readonly favoritesService;
    constructor(goodDeedsService: GoodDeedsService, favoritesService: FavoritesService);
    findAll(query: GoodDeedsQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("./entities/good-deed.entity.js").GoodDeedDto>>;
    findBySlug(slug: string, query: LocaleQueryDto): Promise<{
        locale: string;
        isContemporary: boolean;
        mizan: import("../quotes/quotes.service.js").MizanDto | null;
        branches: {
            number: number;
            titleAr: string;
            title: string | null;
        }[];
        schedule: {
            habits: import("../practice/practice-catalog.js").Habit[];
            occasions: import("../practice/practice-catalog.js").Occasion[];
        };
        id: string;
        name: string;
        nameAr: string;
        slug: string;
        category: string | null;
        description: string | null;
        descriptionAr: string | null;
        reward: string | null;
        rewardAr: string | null;
        oppositeSin: import("./entities/good-deed.entity.js").OppositeSinSummary | null;
        domainKey: string | null;
        taxonomyOrder: number | null;
        pair: import("../sins/entities/sin.entity.js").TopicPairDto | null;
        quoteCount: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findQuotes(slug: string, query: GoodDeedQuotesQueryDto, user: JwtPayload | undefined): Promise<{
        data: {
            goodDeed: {
                id: string;
                slug: string;
                name: string;
                nameAr: string;
                reward: string | null;
                rewardAr: string | null;
                description: string | null;
                descriptionAr: string | null;
                oppositeSin: {
                    id: string;
                    name: string;
                    slug: string;
                    nameAr: string;
                } | null;
            };
            items: {
                link: {
                    id: string;
                    relevanceScore: number | null;
                    note: string | null;
                };
                quote: import("../quotes/entities/quote.entity.js").QuoteDto;
            }[];
            companion?: undefined;
            derived?: undefined;
        };
        meta: import("../../common/dto/paginated-result.js").PageMeta;
    } | {
        data: {
            goodDeed: {
                isContemporary: boolean;
                id: string;
                slug: string;
                name: string;
                nameAr: string;
                reward: string | null;
                rewardAr: string | null;
                description: string | null;
                descriptionAr: string | null;
                oppositeSin: {
                    id: string;
                    name: string;
                    slug: string;
                    nameAr: string;
                } | null;
            };
            items: {
                link: {
                    band?: string | undefined;
                    id: string;
                    relevanceScore: number | null;
                    note: string | null;
                    classifiedBy: string;
                };
                quote: import("../quotes/entities/quote.entity.js").QuoteDto;
            }[];
            companion: {
                items: ReturnType<GoodDeedsService["presentDeedItem"]>[];
            };
            derived: {
                slug: string;
                name: string;
                nameAr: string;
                side: "AVOID" | "DO";
                items: Awaited<ReturnType<GoodDeedsService["pageDeedSource"]>>;
            }[];
        };
        meta: import("../../common/dto/paginated-result.js").PageMeta;
    } | {
        data: {
            items: {
                quote: {
                    isFavorite: boolean;
                    id: string;
                };
                link: unknown;
            }[];
            goodDeed: {
                id: string;
                slug: string;
                name: string;
                nameAr: string;
                reward: string | null;
                rewardAr: string | null;
                description: string | null;
                descriptionAr: string | null;
                oppositeSin: {
                    id: string;
                    name: string;
                    slug: string;
                    nameAr: string;
                } | null;
            };
            companion?: undefined;
            derived?: undefined;
        } | {
            items: {
                quote: {
                    isFavorite: boolean;
                    id: string;
                };
                link: unknown;
            }[];
            goodDeed: {
                isContemporary: boolean;
                id: string;
                slug: string;
                name: string;
                nameAr: string;
                reward: string | null;
                rewardAr: string | null;
                description: string | null;
                descriptionAr: string | null;
                oppositeSin: {
                    id: string;
                    name: string;
                    slug: string;
                    nameAr: string;
                } | null;
            };
            companion: {
                items: ReturnType<GoodDeedsService["presentDeedItem"]>[];
            };
            derived: {
                slug: string;
                name: string;
                nameAr: string;
                side: "AVOID" | "DO";
                items: Awaited<ReturnType<GoodDeedsService["pageDeedSource"]>>;
            }[];
        };
        meta: import("../../common/dto/paginated-result.js").PageMeta;
    }>;
}
