import { type SinRank } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GoodDeedsService } from '../good-deeds/good-deeds.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { CreateSinDto } from './dto/create-sin.dto.js';
import type { SinQuotesQueryDto } from './dto/sin-quotes-query.dto.js';
import type { SinsQueryDto } from './dto/sins-query.dto.js';
import type { UpdateSinDto } from './dto/update-sin.dto.js';
import type { SinDetailDto, SinDto } from './entities/sin.entity.js';
export declare class SinsService {
    private readonly prisma;
    private readonly quotes;
    private readonly goodDeeds;
    constructor(prisma: PrismaService, quotes: QuotesService, goodDeeds: GoodDeedsService);
    toDto(row: {
        id: string;
        name: string;
        nameAr: string;
        slug: string;
        category: string | null;
        description: string | null;
        descriptionAr: string | null;
        severity: number | null;
        rank: SinRank | null;
        rankReference: string | null;
        rankSource: {
            id: string;
            name: string;
            nameAr: string | null;
        } | null;
        domainKey: string | null;
        taxonomyOrder: number | null;
        isContemporary: boolean;
        createdAt: Date;
        updatedAt: Date;
        _count: {
            quotes: number;
        };
    }, options?: {
        includeSeverity?: boolean;
    }): SinDto;
    findAll(query: SinsQueryDto, scope?: 'public' | 'admin'): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<SinDto>>;
    private derivedSinCounts;
    findBySlug(slug: string, lang?: string): Promise<SinDetailDto & {
        locale: string;
    }>;
    findAlternatives(sinId: string): Promise<import("../good-deeds/entities/good-deed.entity.js").GoodDeedSummary[]>;
    findQuotesForSin(slug: string, query: SinQuotesQueryDto): Promise<{
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
    }>;
    private presentSinItem;
    private rewardRanked;
    private rewardPage;
    private derivedLinks;
    private derivedSinTexts;
    private pageTopicQuotes;
    adminCreate(dto: CreateSinDto): Promise<SinDto>;
    adminList(query: SinsQueryDto): Promise<{
        data: {
            severity: number | null;
            id: string;
            name: string;
            nameAr: string;
            slug: string;
            category: string | null;
            description: string | null;
            descriptionAr: string | null;
            rank: SinRank | null;
            rankReference: string | null;
            rankSource: import("./entities/sin.entity.js").SinRankSourceDto | null;
            domainKey: string | null;
            taxonomyOrder: number | null;
            isContemporary: boolean;
            pair: import("./entities/sin.entity.js").TopicPairDto | null;
            quoteCount: number;
            createdAt: Date;
            updatedAt: Date;
        }[];
        meta: import("../../common/dto/paginated-result.js").PageMeta;
    }>;
    adminUpdate(id: string, dto: UpdateSinDto): Promise<SinDto>;
    private assertRankCitation;
    adminDelete(id: string, force?: boolean): Promise<void>;
    findGoodDeedsForSin(slug: string, page?: number, limit?: number, locale?: string): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("../good-deeds/entities/good-deed.entity.js").GoodDeedDto>>;
}
