import { FlagSeverity, FlagStatus, FlagType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class ReviewFlagsQueryDto extends PaginationQueryDto {
    lang?: 'ar' | 'en';
    type?: FlagType;
    severity?: FlagSeverity;
    status?: FlagStatus;
    sourceId?: string;
}
