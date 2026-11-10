import { type HomeMoment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateHomeMomentDto, UpdateHomeMomentDto } from './dto/home-moment.dto.js';
export type MomentTopicType = 'sin' | 'good-deed' | 'branch';
export interface HomeMomentDto {
    key: string;
    label: string;
    situation: string | null;
    icon: string;
    topic: {
        type: MomentTopicType;
        slug: string;
        title: string;
        path: string;
    };
}
export declare class HomeMomentsService {
    private readonly prisma;
    private seed;
    constructor(prisma: PrismaService);
    findPublic(locale: 'ar' | 'en'): Promise<{
        data: HomeMomentDto[];
        meta: {
            locale: string;
            source: 'database' | 'seed';
        };
    }>;
    adminList(): Promise<{
        data: HomeMoment[];
    }>;
    adminCreate(dto: CreateHomeMomentDto): Promise<HomeMoment>;
    adminUpdate(id: string, dto: UpdateHomeMomentDto): Promise<HomeMoment>;
    adminDelete(id: string): Promise<void>;
    private seedRows;
    private topicTitles;
    private assertTopic;
}
