import { type LocalDate } from '@thekra/practice-core';
import type { AppLocale } from '../../common/dto/locale-query.dto.js';
import type { QuoteDto } from '../../common/mappers/quote.mapper.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { OccasionsQueryDto } from './dto/occasions-query.dto.js';
import type { OccasionOccurrenceDto } from './entities/practice.entity.js';
import { type PracticeCatalog } from './practice-catalog.js';
export declare const MAX_OCCASION_SPAN_DAYS = 400;
export declare function utcToday(now?: Date): LocalDate;
export declare function addMonths(date: LocalDate, months: number): LocalDate;
export declare function deedPageUrl(slug: string, lang: AppLocale): string;
export declare class PracticeService {
    private readonly quotes;
    constructor(quotes: QuotesService);
    catalog(): PracticeCatalog;
    evidence(ids: readonly string[], lang: AppLocale): Promise<QuoteDto[]>;
    occasions(query: OccasionsQueryDto, today?: LocalDate): OccasionOccurrenceDto[];
    occasionsIcs(lang: AppLocale, months?: number, today?: LocalDate, now?: Date): string;
}
