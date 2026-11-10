import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { GoodDeedQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import type { CreateGoodDeedDto } from './dto/create-good-deed.dto.js';
import type { GoodDeedsQueryDto } from './dto/good-deeds-query.dto.js';
import type { UpdateGoodDeedDto } from './dto/update-good-deed.dto.js';
import type { GoodDeedDto, GoodDeedSummary } from './entities/good-deed.entity.js';
export declare class GoodDeedsService {
    private readonly prisma;
    private readonly quotes;
    constructor(prisma: PrismaService, quotes: QuotesService);
    toDto(row: {
        id: string;
        name: string;
        nameAr: string;
        slug: string;
        category: string | null;
        description: string | null;
        descriptionAr: string | null;
        reward: string | null;
        rewardAr: string | null;
        createdAt: Date;
        updatedAt: Date;
        oppositeSin: {
            id: string;
            slug: string;
            name: string;
            nameAr: string;
        } | null;
        domainKey: string | null;
        taxonomyOrder: number | null;
        isContemporary: boolean;
        _count: {
            quotes: number;
        };
    }): GoodDeedDto;
    findAll(query: GoodDeedsQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<GoodDeedDto>>;
    private derivedDeedCounts;
    findBySlug(slug: string, lang?: string): Promise<{
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
    adminCreate(dto: CreateGoodDeedDto): Promise<GoodDeedDto>;
    adminUpdate(id: string, dto: UpdateGoodDeedDto): Promise<GoodDeedDto>;
    adminDelete(id: string): Promise<void>;
    findByOppositeSinId(sinId: string, take?: number): Promise<GoodDeedSummary[]>;
    findQuotesForGoodDeed(slug: string, query: GoodDeedQuotesQueryDto): Promise<{
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
    }>;
    private presentDeedItem;
    private warningRanked;
    private warningPage;
    private derivedLinks;
    private derivedDeedTexts;
    private pageDeedSource;
}
