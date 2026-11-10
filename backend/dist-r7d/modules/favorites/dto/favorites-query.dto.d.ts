import { QuoteType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class FavoritesQueryDto extends PaginationQueryDto {
    lang?: 'ar' | 'en';
    type?: QuoteType;
}
