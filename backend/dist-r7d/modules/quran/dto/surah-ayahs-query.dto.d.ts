import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class SurahAyahsQueryDto extends PaginationQueryDto {
    lang?: 'ar' | 'en';
    fromAyah?: number;
    toAyah?: number;
}
