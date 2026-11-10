import type { Source } from '@prisma/client';
import type { Prisma } from '@prisma/client';
export interface ProviderCursor {
    page: number;
    surahFrom?: number;
    surahTo?: number;
    collection?: string;
    bookFrom?: number;
    bookTo?: number;
    dryRun?: boolean;
}
export interface ProviderBatch {
    records: unknown[];
    nextCursor: ProviderCursor | null;
}
export interface MappedQuote {
    externalId: string;
    quote: Omit<Prisma.QuoteUncheckedCreateInput, 'id' | 'apiProvider' | 'externalId' | 'origin'>;
    translations: {
        languageCode: string;
        text: string;
    }[];
}
export interface ContentProvider {
    readonly key: string;
    isConfigured(): boolean;
    fetchBatch(cursor: ProviderCursor): Promise<ProviderBatch>;
    mapToQuote(raw: unknown, source: Source): MappedQuote;
}
export declare class ProviderHttpError extends Error {
    readonly statusCode: number;
    readonly retryAfterMs?: number | undefined;
    constructor(statusCode: number, message: string, retryAfterMs?: number | undefined);
}
export declare class SkipRecordError extends Error {
    constructor(message: string);
}
export declare class RunAbortedError extends Error {
    constructor(message: string);
}
export declare const CONTENT_PROVIDERS_TOKEN = "CONTENT_PROVIDERS";
