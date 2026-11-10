import { AyahDetailQueryDto } from './dto/ayah-detail-query.dto.js';
import { SurahAyahsQueryDto } from './dto/surah-ayahs-query.dto.js';
import { SurahsQueryDto } from './dto/surahs-query.dto.js';
import { QuranService } from './quran.service.js';
export declare class QuranController {
    private readonly quranService;
    constructor(quranService: QuranService);
    listSurahs(query: SurahsQueryDto): Promise<{
        data: import("./entities/surah-summary.entity.js").SurahSummaryDto[];
    }>;
    findAyahsBySurah(surahNumber: number, query: SurahAyahsQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("../quotes/entities/quote.entity.js").QuoteDto>>;
    findAyah(surahNumber: number, ayahNumber: number, query: AyahDetailQueryDto): Promise<{
        data: import("../quotes/entities/quote.entity.js").QuoteDto & {
            translations?: {
                id: string;
                languageCode: string;
                text: string;
            }[] | undefined;
        };
        meta?: {
            duplicateCount: number;
        } | undefined;
    }>;
}
