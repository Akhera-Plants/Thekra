import type { Response } from 'express';
import { UpdateSinLinkDto } from './dto/update-sin-link.dto.js';
import { BranchQuotesAdminQueryDto } from './dto/branch-quotes-admin-query.dto.js';
import { LinkBranchQuoteDto } from './dto/link-branch-quote.dto.js';
import { ClassificationService } from './classification.service.js';
export declare class BranchQuotesAdminController {
    private readonly classification;
    constructor(classification: ClassificationService);
    link(dto: LinkBranchQuoteDto, res: Response): Promise<{
        data: unknown;
    }>;
    list(query: BranchQuotesAdminQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<unknown>>;
    update(id: string, dto: UpdateSinLinkDto): Promise<unknown>;
    unlink(id: string): Promise<void>;
}
