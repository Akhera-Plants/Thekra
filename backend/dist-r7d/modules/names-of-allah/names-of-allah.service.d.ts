import type { QuoteDto } from '../../common/mappers/quote.mapper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { type NameLinkKind } from './names-of-allah.js';
export declare const OTHER_VERSES_MAX = 10;
export interface NameListItemDto {
    number: number;
    slug: string;
    nameAr: string;
    ref: string;
}
export interface NameLinkDto {
    kind: NameLinkKind;
    slug: string;
    nameAr: string;
    name: string;
}
export interface NameDetailDto extends NameListItemDto {
    meaningAr: string;
    meaningEn: string;
    review: string;
    verse: QuoteDto | null;
    links: NameLinkDto[];
    otherVerses: QuoteDto[];
    prev: NameListItemDto | null;
    next: NameListItemDto | null;
}
export declare class NamesOfAllahService {
    private readonly prisma;
    private readonly quotes;
    constructor(prisma: PrismaService, quotes: QuotesService);
    findAll(): {
        data: NameListItemDto[];
    };
    findBySlug(slug: string, lang: 'ar' | 'en'): Promise<{
        data: NameDetailDto;
    }>;
    private otherVerses;
}
