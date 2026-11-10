import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { SinGoodDeedsQueryDto } from './dto/sin-good-deeds-query.dto.js';
import { SinQuotesQueryDto } from './dto/sin-quotes-query.dto.js';
import { SinsQueryDto } from './dto/sins-query.dto.js';
import { SinsService } from './sins.service.js';
export declare class SinsController {
    private readonly sinsService;
    private readonly favoritesService;
    constructor(sinsService: SinsService, favoritesService: FavoritesService);
    findAll(query: SinsQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("./entities/sin.entity.js").SinDto>>;
    findBySlug(slug: string, query: LocaleQueryDto): Promise<import("./entities/sin.entity.js").SinDto & {
        relatedGoodDeeds: import("../good-deeds/entities/good-deed.entity.js").GoodDeedSummary[];
        locale: string;
        isContemporary: boolean;
        branches: {
            number: number;
            titleAr: string;
            title: string | null;
        }[];
        program: {
            available: boolean;
            category: import("@thekra/practice-core").SinCategory | null;
        };
        mizan: import("../quotes/quotes.service.js").MizanDto | null;
    } & {
        locale: string;
    }>;
    findQuotes(slug: string, query: SinQuotesQueryDto, user: JwtPayload | undefined): Promise<{
        data: {
            sin: {
                id: string;
                slug: string;
                name: string;
                nameAr: string;
                rank: import("@prisma/client").$Enums.SinRank | null;
                description: string | null;
                descriptionAr: string | null;
                isContemporary?: undefined;
            };
            items: {
                link: {
                    id: string;
                    relevanceScore: number | null;
                    note: string | null;
                };
                quote: import("../quotes/entities/quote.entity.js").QuoteDto;
            }[];
            alternatives: {
                reward: string | null;
                id: string;
                name: string;
                slug: string;
                nameAr: string;
                rewardAr: string | null;
            }[];
            companion?: undefined;
            derived?: undefined;
        };
        meta: import("../../common/dto/paginated-result.js").PageMeta;
    } | {
        data: {
            sin: {
                id: string;
                slug: string;
                name: string;
                nameAr: string;
                rank: import("@prisma/client").$Enums.SinRank | null;
                description: string | null;
                descriptionAr: string | null;
                isContemporary: boolean;
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
                items: ReturnType<SinsService["presentSinItem"]>[];
            };
            derived: {
                slug: string;
                name: string;
                nameAr: string;
                side: "AVOID" | "DO";
                items: Awaited<ReturnType<SinsService["pageTopicQuotes"]>>;
            }[];
            alternatives: {
                reward: string | null;
                id: string;
                name: string;
                slug: string;
                nameAr: string;
                rewardAr: string | null;
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
            sin: {
                id: string;
                slug: string;
                name: string;
                nameAr: string;
                rank: import("@prisma/client").$Enums.SinRank | null;
                description: string | null;
                descriptionAr: string | null;
                isContemporary?: undefined;
            };
            alternatives: {
                reward: string | null;
                id: string;
                name: string;
                slug: string;
                nameAr: string;
                rewardAr: string | null;
            }[];
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
            sin: {
                id: string;
                slug: string;
                name: string;
                nameAr: string;
                rank: import("@prisma/client").$Enums.SinRank | null;
                description: string | null;
                descriptionAr: string | null;
                isContemporary: boolean;
            };
            companion: {
                items: ReturnType<SinsService["presentSinItem"]>[];
            };
            derived: {
                slug: string;
                name: string;
                nameAr: string;
                side: "AVOID" | "DO";
                items: Awaited<ReturnType<SinsService["pageTopicQuotes"]>>;
            }[];
            alternatives: {
                reward: string | null;
                id: string;
                name: string;
                slug: string;
                nameAr: string;
                rewardAr: string | null;
            }[];
        };
        meta: import("../../common/dto/paginated-result.js").PageMeta;
    }>;
    findGoodDeeds(slug: string, query: SinGoodDeedsQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("../good-deeds/entities/good-deed.entity.js").GoodDeedDto>>;
}
