import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { HadithCollectionsQueryDto } from './dto/hadith-collections-query.dto.js';
import type { HadithQueryDto } from './dto/hadith-query.dto.js';
import type { HadithCollectionDto } from './entities/hadith-collection.entity.js';
export declare class HadithService {
    private readonly prisma;
    private readonly quotes;
    constructor(prisma: PrismaService, quotes: QuotesService);
    findAll(query: HadithQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("../quotes/entities/quote.entity.js").QuoteDto>>;
    listCollections(_query: HadithCollectionsQueryDto): Promise<{
        data: HadithCollectionDto[];
    }>;
}
