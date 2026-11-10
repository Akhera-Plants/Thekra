import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class GoodDeedsQueryDto extends PaginationQueryDto {
    lang?: 'ar' | 'en';
    category?: string;
    q?: string;
    oppositeSinSlug?: string;
    sort?: 'name' | 'quoteCount';
    includeEmpty?: 'true' | 'false';
}
