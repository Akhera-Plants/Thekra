import { ConfigService } from '@nestjs/config';
import type { QuoteDto } from '../../common/mappers/quote.mapper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { AyahDetailQueryDto } from './dto/ayah-detail-query.dto.js';
import type { SurahAyahsQueryDto } from './dto/surah-ayahs-query.dto.js';
import type { SurahsQueryDto } from './dto/surahs-query.dto.js';
import type { SurahSummaryDto } from './entities/surah-summary.entity.js';
export declare class QuranService {
    private readonly prisma;
    private readonly quotes;
    private readonly config;
    private surahsCache;
    constructor(prisma: PrismaService, quotes: QuotesService, config: ConfigService<EnvironmentVariables>);
    assertSurahNumber(surahNumber: number): void;
    listSurahs(_query: SurahsQueryDto): Promise<{
        data: SurahSummaryDto[];
    }>;
    findAyahsBySurah(surahNumber: number, query: SurahAyahsQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<QuoteDto>>;
    findAyah(surahNumber: number, ayahNumber: number, query: AyahDetailQueryDto): Promise<{
        data: QuoteDto & {
            translations?: Array<{
                id: string;
                languageCode: string;
                text: string;
            }>;
        };
        meta?: {
            duplicateCount: number;
        };
    }>;
}
