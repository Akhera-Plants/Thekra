import { LinkReviewStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class BranchQuotesAdminQueryDto extends PaginationQueryDto {
    imanBranchId?: string;
    quoteId?: string;
    reviewStatus?: LinkReviewStatus;
}
