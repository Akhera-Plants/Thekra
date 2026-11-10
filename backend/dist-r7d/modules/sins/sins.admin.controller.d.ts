import type { Response } from 'express';
import { CreateSinDto } from './dto/create-sin.dto.js';
import { SinsQueryDto } from './dto/sins-query.dto.js';
import { UpdateSinDto } from './dto/update-sin.dto.js';
import { SinsService } from './sins.service.js';
declare class DeleteSinQueryDto {
    force?: boolean;
}
export declare class SinsAdminController {
    private readonly sinsService;
    constructor(sinsService: SinsService);
    findAll(query: SinsQueryDto): Promise<{
        data: {
            severity: number | null;
            id: string;
            name: string;
            nameAr: string;
            slug: string;
            category: string | null;
            description: string | null;
            descriptionAr: string | null;
            rank: import("@prisma/client").SinRank | null;
            rankReference: string | null;
            rankSource: import("./entities/sin.entity.js").SinRankSourceDto | null;
            domainKey: string | null;
            taxonomyOrder: number | null;
            isContemporary: boolean;
            pair: import("./entities/sin.entity.js").TopicPairDto | null;
            quoteCount: number;
            createdAt: Date;
            updatedAt: Date;
        }[];
        meta: import("../../common/dto/paginated-result.js").PageMeta;
    }>;
    create(dto: CreateSinDto, res: Response): Promise<{
        data: import("./entities/sin.entity.js").SinDto;
    }>;
    update(id: string, dto: UpdateSinDto): Promise<import("./entities/sin.entity.js").SinDto>;
    remove(id: string, query: DeleteSinQueryDto): Promise<void>;
}
export {};
