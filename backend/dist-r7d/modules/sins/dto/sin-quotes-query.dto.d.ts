import { HadithGrade, QuoteType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export type QuoteKind = 'verse' | 'hadith' | 'athar';
export declare class SinQuotesQueryDto extends PaginationQueryDto {
    limit?: number;
    lang?: 'ar' | 'en';
    type?: QuoteType[];
    kind?: QuoteKind;
    theme?: string;
    grades?: HadithGrade[];
    includeWeak?: boolean;
    minScore?: number;
    shuffle?: boolean;
    seed?: string;
}
export { SinQuotesQueryDto as GoodDeedQuotesQueryDto };
