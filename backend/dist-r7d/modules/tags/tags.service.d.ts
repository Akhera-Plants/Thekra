import type { CreateTagDto } from './dto/create-tag.dto.js';
import type { UpdateTagDto } from './dto/update-tag.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { TagDetailQueryDto } from './dto/tag-detail-query.dto.js';
import type { TagsQueryDto } from './dto/tags-query.dto.js';
import type { TagWithQuoteCountDto } from './entities/tag.entity.js';
type TagRowWithCount = {
    id: string;
    name: string;
    nameAr: string | null;
    slug: string;
    category: TagWithQuoteCountDto['category'];
    _count: {
        quotes: number;
    };
};
export declare class TagsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    toTagDto(row: TagRowWithCount): TagWithQuoteCountDto;
    findAll(query: TagsQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<TagWithQuoteCountDto>>;
    findBySlug(slug: string, _query: TagDetailQueryDto): Promise<TagWithQuoteCountDto>;
    adminCreate(dto: CreateTagDto): Promise<TagWithQuoteCountDto>;
    adminUpdate(id: string, dto: UpdateTagDto): Promise<TagWithQuoteCountDto>;
    adminDelete(id: string): Promise<void>;
    private buildListWhere;
}
export {};
