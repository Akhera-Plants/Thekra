import { TagCategory } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class TagsQueryDto extends PaginationQueryDto {
    lang?: 'ar' | 'en';
    category?: TagCategory;
    q?: string;
}
