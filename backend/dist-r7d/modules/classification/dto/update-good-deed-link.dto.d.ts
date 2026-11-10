import { LinkReviewStatus } from '@prisma/client';
import { LinkEditorialFieldsDto } from './link-editorial-fields.dto.js';
export declare class UpdateGoodDeedLinkDto extends LinkEditorialFieldsDto {
    relevanceScore?: number;
    note?: string | null;
    reviewStatus?: LinkReviewStatus;
}
