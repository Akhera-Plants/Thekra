import type { Response } from 'express';
import { CreateHomeMomentDto, UpdateHomeMomentDto } from './dto/home-moment.dto.js';
import { HomeMomentsService } from './home-moments.service.js';
export declare class HomeMomentsAdminController {
    private readonly service;
    constructor(service: HomeMomentsService);
    findAll(): Promise<{
        data: import("@prisma/client").HomeMoment[];
    }>;
    create(dto: CreateHomeMomentDto, res: Response): Promise<{
        data: {
            id: string;
            updatedAt: Date;
            createdAt: Date;
            key: string;
            sortOrder: number;
            published: boolean;
            labelAr: string;
            labelEn: string;
            situationAr: string | null;
            situationEn: string | null;
            icon: string;
            topicType: import("@prisma/client").$Enums.HomeMomentTopic;
            topicSlug: string;
        };
    }>;
    update(id: string, dto: UpdateHomeMomentDto): Promise<{
        data: {
            id: string;
            updatedAt: Date;
            createdAt: Date;
            key: string;
            sortOrder: number;
            published: boolean;
            labelAr: string;
            labelEn: string;
            situationAr: string | null;
            situationEn: string | null;
            icon: string;
            topicType: import("@prisma/client").$Enums.HomeMomentTopic;
            topicSlug: string;
        };
    }>;
    remove(id: string): Promise<void>;
}
