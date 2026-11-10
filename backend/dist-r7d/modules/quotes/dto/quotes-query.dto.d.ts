import { HadithGrade, QuoteOrigin, QuoteType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export declare class QuotesQueryDto extends PaginationQueryDto {
    lang?: 'ar' | 'en';
    q?: string;
    type?: QuoteType[];
    origin?: QuoteOrigin;
    grades?: HadithGrade[];
    includeWeak?: boolean;
    sourceId?: string;
    tag?: string[];
    sinSlug?: string;
    goodDeedSlug?: string;
    surahNumber?: number;
    ayahNumber?: number;
    hasTranslation?: string;
    sort?: 'relevance' | 'newest' | 'oldest';
}
