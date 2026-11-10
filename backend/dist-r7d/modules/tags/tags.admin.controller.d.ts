import type { Response } from 'express';
import { CreateTagDto } from './dto/create-tag.dto.js';
import { UpdateTagDto } from './dto/update-tag.dto.js';
import { TagsService } from './tags.service.js';
export declare class TagsAdminController {
    private readonly tagsService;
    constructor(tagsService: TagsService);
    create(dto: CreateTagDto, res: Response): Promise<{
        data: import("./entities/tag.entity.js").TagWithQuoteCountDto;
    }>;
    update(id: string, dto: UpdateTagDto): Promise<import("./entities/tag.entity.js").TagWithQuoteCountDto>;
    remove(id: string): Promise<void>;
}
