import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateChapterMapDto } from './dto/create-chapter-map.dto.js';
export declare class ChapterMapsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateChapterMapDto): Promise<{
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
    list(sourceId?: string): Promise<{
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
    updateReviewed(id: string, reviewed: boolean): Promise<{
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
    private assertTarget;
    private assertRefs;
}
