import { SourceType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class SourcesQueryDto extends PaginationQueryDto {
    lang?: 'ar' | 'en';
    type?: SourceType;
    isExternalApi?: boolean;
}
