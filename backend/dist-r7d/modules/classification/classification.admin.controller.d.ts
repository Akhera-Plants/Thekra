import type { Response } from 'express';
import { ClassificationService } from './classification.service.js';
import { BulkLinkGoodDeedQuotesDto } from './dto/bulk-link-good-deed-quotes.dto.js';
import { BulkLinkSinQuotesDto } from './dto/bulk-link-sin-quotes.dto.js';
import { GoodDeedQuotesAdminQueryDto } from './dto/good-deed-quotes-admin-query.dto.js';
import { LinkGoodDeedQuoteDto } from './dto/link-good-deed-quote.dto.js';
import { LinkSinQuoteDto } from './dto/link-sin-quote.dto.js';
import { RevokeGoodDeedGroupDto, RevokeSinGroupDto } from './dto/revoke-link-group.dto.js';
import { SinQuotesAdminQueryDto } from './dto/sin-quotes-admin-query.dto.js';
import { UpdateGoodDeedLinkDto } from './dto/update-good-deed-link.dto.js';
import { UpdateSinLinkDto } from './dto/update-sin-link.dto.js';
export declare class SinQuotesAdminController {
    private readonly classificationService;
    constructor(classificationService: ClassificationService);
    linkSinQuote(dto: LinkSinQuoteDto, res: Response): Promise<{
        data: import("./entities/sin-link.entity.js").SinLinkDto;
    }>;
    listSinQuotes(query: SinQuotesAdminQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("./entities/sin-link.entity.js").SinLinkDto>>;
    updateSinLink(id: string, dto: UpdateSinLinkDto): Promise<import("./entities/sin-link.entity.js").SinLinkDto>;
    unlinkSinQuote(id: string): Promise<void>;
    bulkLinkSinQuotes(dto: BulkLinkSinQuotesDto): Promise<import("./classification.service.js").BulkResult>;
    revokeSinGroup(dto: RevokeSinGroupDto): Promise<{
        revoked: number;
    }>;
}
export declare class GoodDeedQuotesAdminController {
    private readonly classificationService;
    constructor(classificationService: ClassificationService);
    linkGoodDeedQuote(dto: LinkGoodDeedQuoteDto, res: Response): Promise<{
        data: import("./entities/good-deed-link.entity.js").GoodDeedLinkDto;
    }>;
    listGoodDeedQuotes(query: GoodDeedQuotesAdminQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("./entities/good-deed-link.entity.js").GoodDeedLinkDto>>;
    updateGoodDeedLink(id: string, dto: UpdateGoodDeedLinkDto): Promise<import("./entities/good-deed-link.entity.js").GoodDeedLinkDto>;
    unlinkGoodDeedQuote(id: string): Promise<void>;
    bulkLinkGoodDeedQuotes(dto: BulkLinkGoodDeedQuotesDto): Promise<import("./classification.service.js").BulkResult>;
    revokeGoodDeedGroup(dto: RevokeGoodDeedGroupDto): Promise<{
        revoked: number;
    }>;
}
