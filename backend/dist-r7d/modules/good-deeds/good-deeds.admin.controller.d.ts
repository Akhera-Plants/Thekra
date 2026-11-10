import type { Response } from 'express';
import { CreateGoodDeedDto } from './dto/create-good-deed.dto.js';
import { UpdateGoodDeedDto } from './dto/update-good-deed.dto.js';
import { GoodDeedsService } from './good-deeds.service.js';
export declare class GoodDeedsAdminController {
    private readonly goodDeedsService;
    constructor(goodDeedsService: GoodDeedsService);
    create(dto: CreateGoodDeedDto, res: Response): Promise<{
        data: import("./entities/good-deed.entity.js").GoodDeedDto;
    }>;
    update(id: string, dto: UpdateGoodDeedDto): Promise<import("./entities/good-deed.entity.js").GoodDeedDto>;
    remove(id: string): Promise<void>;
}
