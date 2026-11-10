import { ExplanationKind, QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from './quotes.service.js';
export declare const READER_TAFSIRS: readonly [{
    readonly key: "mukhtasar";
    readonly sourceId: "10000000-0000-4000-8000-000000000025";
}, {
    readonly key: "sadi";
    readonly sourceId: "10000000-0000-4000-8000-000000000013";
}, {
    readonly key: "ibn-ashur";
    readonly sourceId: "10000000-0000-4000-8000-000000000014";
}];
export type ReaderTafsirKey = (typeof READER_TAFSIRS)[number]['key'];
type ExplanationSource = {
    id: string;
    name: string;
    nameAr: string | null;
    type: string;
    author: string | null;
    authorAr: string | null;
};
export interface ReaderTafsirDto {
    key: ReaderTafsirKey;
    source: ExplanationSource;
    languageCode: string;
    entries: Array<{
        id: string;
        ayahKey: string | null;
        text: string;
        reference: string | null;
    }>;
}
export interface ReaderExplanationDto {
    id: string;
    kind: ExplanationKind;
    languageCode: string;
    text: string;
    reference: string | null;
    source: ExplanationSource;
}
export interface QuoteReaderDto {
    quoteId: string;
    type: QuoteType;
    reminderAngle: {
        text: string;
        languageCode: 'ar' | 'en';
    } | null;
    tafsirs: ReaderTafsirDto[];
    explanations: ReaderExplanationDto[];
}
export declare class QuoteReaderService {
    private readonly prisma;
    private readonly quotes;
    constructor(prisma: PrismaService, quotes: QuotesService);
    read(quoteId: string, lang: 'ar' | 'en', linkId?: string): Promise<{
        data: QuoteReaderDto;
    }>;
    private reminderAngle;
}
export {};
