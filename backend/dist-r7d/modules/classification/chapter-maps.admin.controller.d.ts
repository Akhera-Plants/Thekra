import type { Response } from 'express';
import { ChapterMapsService } from './chapter-maps.service.js';
import { CreateChapterMapDto } from './dto/create-chapter-map.dto.js';
declare class ChapterMapListQueryDto {
    sourceId?: string;
}
declare class UpdateChapterMapDto {
    reviewed: boolean;
}
export declare class ChapterMapsAdminController {
    private readonly maps;
    constructor(maps: ChapterMapsService);
    create(dto: CreateChapterMapDto, res: Response): Promise<{
        data: {
            id: string;
            updatedAt: Date;
            createdAt: Date;
            sourceId: string;
            imanBranchId: string | null;
            goodDeedId: string | null;
            sinId: string | null;
            chapterKey: string;
            chapterTitleAr: string;
            targetType: import("@prisma/client").$Enums.ChapterMapTarget;
            reviewed: boolean;
        };
    }>;
    list(query: ChapterMapListQueryDto): Promise<{
        data: {
            id: string;
            updatedAt: Date;
            createdAt: Date;
            sourceId: string;
            imanBranchId: string | null;
            goodDeedId: string | null;
            sinId: string | null;
            chapterKey: string;
            chapterTitleAr: string;
            targetType: import("@prisma/client").$Enums.ChapterMapTarget;
            reviewed: boolean;
        }[];
    }>;
    update(id: string, dto: UpdateChapterMapDto): Promise<{
        data: {
            id: string;
            updatedAt: Date;
            createdAt: Date;
            sourceId: string;
            imanBranchId: string | null;
            goodDeedId: string | null;
            sinId: string | null;
            chapterKey: string;
            chapterTitleAr: string;
            targetType: import("@prisma/client").$Enums.ChapterMapTarget;
            reviewed: boolean;
        };
    }>;
    remove(id: string): Promise<void>;
}
export {};
