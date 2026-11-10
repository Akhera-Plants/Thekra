import { HadithCollectionsQueryDto } from './dto/hadith-collections-query.dto.js';
import { HadithQueryDto } from './dto/hadith-query.dto.js';
import { HadithService } from './hadith.service.js';
export declare class HadithController {
    private readonly hadithService;
    constructor(hadithService: HadithService);
    listCollections(query: HadithCollectionsQueryDto): Promise<{
        data: import("./entities/hadith-collection.entity.js").HadithCollectionDto[];
    }>;
    findAll(query: HadithQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("../quotes/entities/quote.entity.js").QuoteDto>>;
}
