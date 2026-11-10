import { SourcesQueryDto } from './dto/sources-query.dto.js';
import { SourcesService } from './sources.service.js';
export declare class SourcesController {
    private readonly sourcesService;
    constructor(sourcesService: SourcesService);
    findAll(query: SourcesQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("./entities/source.entity.js").SourceDto>>;
    findById(id: string): Promise<import("./entities/source.entity.js").SourceDto>;
}
