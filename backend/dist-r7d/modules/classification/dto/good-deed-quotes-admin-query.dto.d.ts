import { ClassifiedBy, LinkReviewStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class GoodDeedQuotesAdminQueryDto extends PaginationQueryDto {
    goodDeedId?: string;
    quoteId?: string;
    minScore?: number;
    maxScore?: number;
    hasNote?: boolean;
    sort?: 'score' | 'newest';
    reviewStatus?: LinkReviewStatus;
    classifiedBy?: ClassifiedBy;
}
