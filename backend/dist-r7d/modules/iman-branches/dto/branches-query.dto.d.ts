import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class BranchesQueryDto extends PaginationQueryDto {
    lang?: 'ar' | 'en';
    q?: string;
    sort?: 'number' | 'quoteCount';
}
