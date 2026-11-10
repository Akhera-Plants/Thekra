import { SinRank } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class SinsQueryDto extends PaginationQueryDto {
    lang?: 'ar' | 'en';
    category?: string;
    q?: string;
    rank?: SinRank;
    sort?: 'name' | 'quoteCount';
    includeEmpty?: 'true' | 'false';
}
