import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { QuoteDto } from '../quotes/entities/quote.entity.js';
import type { CreateReminderSetDto, UpdateReminderSetDto } from './dto/reminder-set.dto.js';
export interface ReminderSetSummaryDto {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    sortOrder: number;
    published: boolean;
    itemCount: number;
}
export interface ReminderSetDetailDto extends ReminderSetSummaryDto {
    items: QuoteDto[];
}
export interface AdminReminderSetDto extends ReminderSetSummaryDto {
    quoteIds: string[];
}
export declare class ReminderSetsService {
    private readonly prisma;
    private readonly quotes;
    constructor(prisma: PrismaService, quotes: QuotesService);
    private summary;
    findPublished(locale: 'ar' | 'en'): Promise<{
        data: ReminderSetDetailDto[];
    }>;
    findPublishedBySlug(slug: string, locale: 'ar' | 'en'): Promise<{
        data: ReminderSetDetailDto;
    }>;
    private toAdmin;
    adminList(): Promise<{
        data: AdminReminderSetDto[];
    }>;
    adminFind(id: string): Promise<{
        data: AdminReminderSetDto & {
            items: QuoteDto[];
        };
    }>;
    adminCreate(dto: CreateReminderSetDto): Promise<AdminReminderSetDto>;
    adminUpdate(id: string, dto: UpdateReminderSetDto): Promise<AdminReminderSetDto>;
    adminDelete(id: string): Promise<void>;
    ineligibleIds(ids: readonly string[]): Promise<string[]>;
    adminSetItems(id: string, quoteIds: readonly string[]): Promise<AdminReminderSetDto>;
}
