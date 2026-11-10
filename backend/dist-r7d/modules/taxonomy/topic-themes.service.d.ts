import { PrismaService } from '../../prisma/prisma.service.js';
export interface TopicThemeIndexEntry {
    key: string;
    ar: string;
    en: string;
    terms: string[];
    topic: {
        slug: string;
        side: 'AVOID' | 'DO';
    };
    pages: {
        sins: string | null;
        goodDeeds: string | null;
    };
    pageTitleAr: string;
    pageTitleEn: string;
}
export declare class TopicThemesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    index(): Promise<{
        data: TopicThemeIndexEntry[];
    }>;
}
