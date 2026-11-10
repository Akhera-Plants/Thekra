import { ConfigService } from '@nestjs/config';
import { HadithGrade, Prisma, QuoteType } from '@prisma/client';
import { quoteIncludeForDto, type QuoteDto, type QuoteRowForDto } from '../../common/mappers/quote.mapper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { AdminQuotesQueryDto } from './dto/admin-quotes-query.dto.js';
import type { CreateQuoteDto } from './dto/create-quote.dto.js';
import type { QuoteDetailQueryDto } from './dto/quote-detail-query.dto.js';
import type { QuotesQueryDto } from './dto/quotes-query.dto.js';
import type { UpdateQuoteDto } from './dto/update-quote.dto.js';
export interface MizanDto {
    source: 'curated' | 'top';
    items: QuoteDto[];
}
export declare const PUBLISHED_LINK_REVIEW_STATUS: "ACCEPTED";
export type ShuffleLinkTable = '"SinQuote"' | '"GoodDeedQuote"' | '"ImanBranchQuote"';
export type ShuffleParentKey = '"sinId"' | '"goodDeedId"' | '"imanBranchId"';
export declare class QuotesService {
    private readonly prisma;
    private readonly config;
    constructor(prisma: PrismaService, config: ConfigService<EnvironmentVariables>);
    buildQuoteInclude(locale: 'ar' | 'en', options?: {
        includeAllTranslations?: boolean;
    }): typeof quoteIncludeForDto;
    private buildQuoteDetailInclude;
    hydrateLinks<TLink extends {
        quoteId: string;
    }>(links: readonly TLink[], locale: 'ar' | 'en'): Promise<Array<Omit<TLink, 'quote'> & {
        quote: QuoteRowForDto;
    }>>;
    toQuoteDto(row: QuoteRowForDto, locale: 'ar' | 'en'): QuoteDto;
    reminderOfTheDay(locale: 'ar' | 'en', now?: Date): Promise<{
        data: QuoteDto | null;
    }>;
    findPublishedByIds(ids: readonly string[], locale: 'ar' | 'en'): Promise<QuoteDto[]>;
    mizan(curatedIds: readonly string[], topQuoteId: (quoteFilter: Prisma.QuoteWhereInput) => Promise<string | null>, locale: 'ar' | 'en'): Promise<MizanDto | null>;
    buildLinkQuoteFilter(query: {
        type?: QuoteType[];
        grades?: HadithGrade[];
        includeWeak?: boolean;
        kind?: 'verse' | 'hadith' | 'athar';
    }): {
        quoteFilter: Prisma.QuoteWhereInput;
        allowedGrades: HadithGrade[];
    };
    buildKindFilter(kind: 'verse' | 'hadith' | 'athar'): Prisma.QuoteWhereInput;
    countsByKind<TWhere extends object>(opts: {
        linkTable: 'sinLinks' | 'goodDeedLinks' | 'imanBranchLinks';
        linkWhere: TWhere;
    }): Promise<{
        all: number;
        verse: number;
        hadith: number;
        athar: number;
    }>;
    countsByTypeFromGroups(groups: Array<{
        type: string;
        _count: {
            _all: number;
        };
    }>): Record<string, number>;
    getVarietyScoreFloor(): number;
    shuffleLinksPage(opts: {
        table: ShuffleLinkTable;
        parentKey: ShuffleParentKey;
        parentId: string;
        minScore?: number;
        types?: QuoteType[];
        allowedGrades: HadithGrade[];
        seed: string;
        floor: number;
        page: number;
        limit: number;
    }): Promise<string[]>;
    search(query: QuotesQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<QuoteDto>>;
    findById(id: string, query: QuoteDetailQueryDto): Promise<QuoteDto & {
        translations?: Array<{
            id: string;
            languageCode: string;
            text: string;
        }>;
        relatedSins?: Array<{
            slug: string;
            name: string;
            nameAr: string;
            relevanceScore: number | null;
        }>;
        relatedGoodDeeds?: Array<{
            slug: string;
            name: string;
            nameAr: string;
            relevanceScore: number | null;
        }>;
    }>;
    private assertPublicQuote;
    private assertPublicRow;
    private toQuoteDetailResult;
    adminSearch(query: AdminQuotesQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<QuoteDto>>;
    markTextVerified(id: string): Promise<QuoteDto>;
    private printedReference;
    adminCreate(dto: CreateQuoteDto): Promise<QuoteDto>;
    adminUpdate(id: string, dto: UpdateQuoteDto): Promise<QuoteDto>;
    adminDelete(id: string): Promise<void>;
    upsertTranslation(quoteId: string, languageCode: string, text: string): Promise<{
        id: string;
        quoteId: string;
        text: string;
        languageCode: string;
    }>;
    createTranslation(quoteId: string, languageCode: string, text: string): Promise<{
        id: string;
        quoteId: string;
        text: string;
        languageCode: string;
    }>;
    deleteTranslation(quoteId: string, languageCode: string): Promise<void>;
    setQuoteTags(quoteId: string, tagIds: string[]): Promise<{
        id: string;
        slug: string;
        name: string;
        nameAr: string | null;
        category: import("@prisma/client").$Enums.TagCategory;
    }[]>;
    private buildAdminSearchWhere;
    private buildSearchWhere;
    listPublicExplanations(quoteId: string, lang?: 'ar' | 'en'): Promise<{
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
    publicExplanationRows(quoteId: string, lang?: 'ar' | 'en'): Promise<{
        quote: {
            id: string;
            type: import("@prisma/client").$Enums.QuoteType;
        };
        rows: ({
            source: {
                id: string;
                name: string;
                type: import("@prisma/client").$Enums.SourceType;
                author: string | null;
                nameAr: string | null;
                authorAr: string | null;
            };
        } & {
            id: string;
            updatedAt: Date;
            createdAt: Date;
            quoteId: string | null;
            kind: import("@prisma/client").$Enums.ExplanationKind;
            origin: import("@prisma/client").$Enums.QuoteOrigin;
            sourceId: string;
            externalId: string | null;
            apiProvider: string | null;
            rawPayload: Prisma.JsonValue | null;
            reference: string | null;
            text: string;
            imanBranchId: string | null;
            languageCode: string;
            ayahKey: string | null;
            sortOrder: number;
        })[];
    }>;
}
