import type { Response } from 'express';
import { CreateSourceDto } from './dto/create-source.dto.js';
import { UpdateSourceDto } from './dto/update-source.dto.js';
import { SourcesService } from './sources.service.js';
export declare class SourcesAdminController {
    private readonly sourcesService;
    constructor(sourcesService: SourcesService);
    create(dto: CreateSourceDto, res: Response): Promise<{
        data: import("./entities/source.entity.js").SourceDto;
    }>;
    update(id: string, dto: UpdateSourceDto): Promise<import("./entities/source.entity.js").SourceDto>;
    remove(id: string): Promise<void>;
}
