import { TextSource } from '@prisma/client';
import { QuotesQueryDto } from './quotes-query.dto.js';
export declare class AdminQuotesQueryDto extends QuotesQueryDto {
    unlinkedOnly?: boolean;
    missingTranslation?: string;
    textSource?: TextSource;
    unverifiedOnly?: boolean;
}
