import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateSourceDto } from './dto/create-source.dto.js';
import type { SourcesQueryDto } from './dto/sources-query.dto.js';
import type { UpdateSourceDto } from './dto/update-source.dto.js';
import type { SourceDto } from './entities/source.entity.js';
type SourceRowWithCount = {
    id: string;
    name: string;
    nameAr: string | null;
    type: SourceDto['type'];
    author: string | null;
    authorAr: string | null;
    language: string;
    isExternalApi: boolean;
    apiProvider: string | null;
    apiBaseUrl: string | null;
    lastSyncedAt: Date | null;
    _count: {
        quotes: number;
        explanations?: number;
    };
};
export declare class SourcesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    toSourceDto(row: SourceRowWithCount, publishedQuoteCount?: number): SourceDto;
    private publishedWhere;
    findAll(query: SourcesQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<SourceDto>>;
    findById(id: string): Promise<SourceDto>;
    adminCreate(dto: CreateSourceDto): Promise<SourceDto>;
    adminUpdate(id: string, dto: UpdateSourceDto): Promise<SourceDto>;
    adminDelete(id: string): Promise<void>;
    private buildListWhere;
}
export {};
