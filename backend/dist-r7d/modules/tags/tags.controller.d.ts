import { TagDetailQueryDto } from './dto/tag-detail-query.dto.js';
import { TagsQueryDto } from './dto/tags-query.dto.js';
import { TagsService } from './tags.service.js';
export declare class TagsController {
    private readonly tagsService;
    constructor(tagsService: TagsService);
    findAll(query: TagsQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("./entities/tag.entity.js").TagWithQuoteCountDto>>;
    findBySlug(slug: string, query: TagDetailQueryDto): Promise<import("./entities/tag.entity.js").TagWithQuoteCountDto>;
}
