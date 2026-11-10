import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import type { Source } from '@prisma/client';
import { type ContentProvider, type ProviderCursor, type ProviderBatch, type MappedQuote } from './content-provider.interface.js';
export declare class QuranComProvider implements ContentProvider {
    private readonly httpService;
    private readonly config;
    readonly key = "quran.com";
    private readonly logger;
    private chapterCache;
    constructor(httpService: HttpService, config: ConfigService);
    isConfigured(): boolean;
    fetchBatch(cursor: ProviderCursor): Promise<ProviderBatch>;
    mapToQuote(raw: unknown, source: Source): MappedQuote;
    private loadChapterCache;
    private wrapAxiosError;
}
