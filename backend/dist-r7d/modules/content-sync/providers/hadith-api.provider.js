var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var HadithApiProvider_1;
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QuoteType } from '@prisma/client';
import { resolveWeakestGrade } from '../mappers/grade.mapper.js';
import { ProviderHttpError, SkipRecordError, } from './content-provider.interface.js';
let HadithApiProvider = HadithApiProvider_1 = class HadithApiProvider {
    httpService;
    config;
    key = 'hadithapi.com';
    logger = new Logger(HadithApiProvider_1.name);
    constructor(httpService, config) {
        this.httpService = httpService;
        this.config = config;
    }
    isConfigured() {
        const key = this.config.get('HADITH_API_KEY');
        return !!key && key.trim().length > 0;
    }
    async fetchBatch(cursor) {
        const apiKey = this.config.get('HADITH_API_KEY');
        if (!apiKey)
            throw new ProviderHttpError(0, 'HADITH_API_KEY not configured');
        const baseUrl = 'https://hadithapi.com/api';
        const collection = cursor.collection ?? 'sahih-bukhari';
        const params = {
            apiKey,
            book: collection,
            paginate: 25,
            page: cursor.page,
        };
        const headers = {
            'User-Agent': 'Thekra/1.0 (+contact@thekra.app)',
        };
        const axiosConfig = { headers, params, timeout: 15_000 };
        const url = `${baseUrl}/hadiths`;
        let resp;
        try {
            resp = await firstValueFrom(this.httpService.get(url, axiosConfig));
        }
        catch (err) {
            throw this.wrapAxiosError(err, collection, cursor.page);
        }
        const { hadiths } = resp.data;
        const hasMore = hadiths.current_page < hadiths.last_page;
        const nextCursor = hasMore
            ? { ...cursor, page: cursor.page + 1 }
            : null;
        this.logger.log(`hadithapi.com: fetched ${collection} page ${hadiths.current_page}/${hadiths.last_page} — ${hadiths.data.length} hadiths`);
        return { records: hadiths.data, nextCursor };
    }
    mapToQuote(raw, source) {
        const h = raw;
        if (!h.hadithArabic || h.hadithArabic.trim() === '') {
            throw new SkipRecordError(`hadithapi.com ${h.bookSlug}:${h.hadithNumber} has no Arabic text`);
        }
        const { grade, unmappedStrings } = resolveWeakestGrade([h.status]);
        if (unmappedStrings.length > 0) {
            this.logger.warn({ book: h.bookSlug, hadithNumber: h.hadithNumber, unmappedStrings }, 'hadithapi.com: unrecognised status string — mapped to UNGRADED');
        }
        const externalId = `${h.bookSlug}:${h.hadithNumber}`;
        const referenceNumber = Number.parseInt(String(h.hadithNumber), 10);
        const narrator = h.englishNarrator
            ? h.englishNarrator.replace(/^Narrated\s*/i, '').replace(/:$/, '').trim() || null
            : null;
        const safePayload = { ...h };
        return {
            externalId,
            quote: {
                type: QuoteType.HADITH,
                textAr: h.hadithArabic,
                sourceId: source.id,
                surahNumber: null,
                surahName: null,
                surahNameAr: null,
                ayahNumber: null,
                narrator,
                narratorAr: null,
                grade,
                hadithReference: null,
                referenceNumber: Number.isInteger(referenceNumber) ? referenceNumber : null,
                referenceLabel: Number.isInteger(referenceNumber) ? null : String(h.hadithNumber),
                bookTitle: null,
                author: null,
                pageOrChapter: null,
                rawPayload: safePayload,
            },
            translations: h.hadithEnglish
                ? [{ languageCode: 'en', text: h.hadithEnglish }]
                : [],
        };
    }
    wrapAxiosError(err, collection, page) {
        if (err !== null &&
            typeof err === 'object' &&
            'response' in err &&
            err.response !== null &&
            typeof err.response === 'object' &&
            'status' in err.response) {
            const response = err.response;
            const retryAfterHeader = response.headers?.['retry-after'];
            const retryAfterMs = retryAfterHeader ? parseRetryAfter(retryAfterHeader) : undefined;
            return new ProviderHttpError(response.status, `hadithapi.com ${collection} page ${page} HTTP ${response.status}`, retryAfterMs);
        }
        return new ProviderHttpError(0, String(err));
    }
};
HadithApiProvider = HadithApiProvider_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [HttpService,
        ConfigService])
], HadithApiProvider);
export { HadithApiProvider };
function parseRetryAfter(header) {
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds))
        return seconds * 1000;
    const date = new Date(header);
    if (!isNaN(date.getTime()))
        return Math.max(0, date.getTime() - Date.now());
    return 5_000;
}
//# sourceMappingURL=hadith-api.provider.js.map