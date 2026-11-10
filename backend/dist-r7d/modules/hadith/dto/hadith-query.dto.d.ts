import { HadithGrade } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class HadithQueryDto extends PaginationQueryDto {
    lang?: 'ar' | 'en';
    collectionId?: string;
    narrator?: string;
    grades?: HadithGrade[];
    includeWeak?: boolean;
    q?: string;
    reference?: string;
}
