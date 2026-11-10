var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SunnahProvider_1;
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QuoteType } from '@prisma/client';
import { resolveWeakestGrade } from '../mappers/grade.mapper.js';
import { ProviderHttpError, SkipRecordError, } from './content-provider.interface.js';
let SunnahProvider = SunnahProvider_1 = class SunnahProvider {
    httpService;
    config;
    key = 'sunnah.com';
    logger = new Logger(SunnahProvider_1.name);
    constructor(httpService, config) {
        this.httpService = httpService;
        this.config = config;
    }
    isConfigured() {
        const key = this.config.get('SUNNAH_API_KEY');
        return !!key && key.trim().length > 0;
    }
    async fetchBatch(cursor) {
        const key = this.config.get('SUNNAH_API_KEY');
        if (!key)
            throw new ProviderHttpError(0, 'SUNNAH_API_KEY not configured');
        const baseUrl = 'https://api.sunnah.com/v1';
        const collection = cursor.collection ?? 'bukhari';
        const bookFrom = cursor.bookFrom ?? 1;
        const bookNumber = bookFrom + (cursor.page - 1);
        const headers = {
            'X-API-Key': key,
            'User-Agent': 'Thekra/1.0 (+contact@thekra.app)',
        };
        const axiosConfig = { headers, params: { limit: 50, page: 1 }, timeout: 15_000 };
        const url = `${baseUrl}/collections/${collection}/books/${bookNumber}/hadiths`;
        let resp;
        try {
            resp = await firstValueFrom(this.httpService.get(url, axiosConfig));
        }
        catch (err) {
            throw this.wrapAxiosError(err, collection, bookNumber);
        }
        const hadiths = (resp.data.hadiths ?? resp.data.data ?? []);
        const bookTo = cursor.bookTo;
        const nextBook = bookNumber + 1;
        const nextCursor = bookTo === undefined || nextBook <= bookTo
            ? { ...cursor, page: cursor.page + 1, bookFrom: nextBook }
            : null;
        this.logger.log(`sunnah.com: fetched ${collection} book ${bookNumber} — ${hadiths.length} hadiths`);
        return { records: hadiths, nextCursor };
    }
    mapToQuote(raw, source) {
        const hadith = raw;
        const arEntry = hadith.hadith.find((h) => h.lang === 'ar');
        if (!arEntry || !arEntry.body || arEntry.body.trim() === '') {
            throw new SkipRecordError(`sunnah.com ${hadith.collection}:${hadith.hadithNumber} has no Arabic text`);
        }
        const enEntry = hadith.hadith.find((h) => h.lang === 'en');
        const allGrades = hadith.hadith.flatMap((h) => h.grades.map((g) => g.grade));
        const { grade, unmappedStrings } = resolveWeakestGrade(allGrades);
        if (unmappedStrings.length > 0) {
            this.logger.warn({ collection: hadith.collection, hadithNumber: hadith.hadithNumber, unmappedStrings }, 'sunnah.com: unrecognised grade strings — mapped to UNGRADED');
        }
        const externalId = `${hadith.collection}:${hadith.hadithNumber}`;
        const referenceNumber = Number.parseInt(String(hadith.hadithNumber), 10);
        const translations = enEntry?.body
            ? [{ languageCode: 'en', text: enEntry.body }]
            : [];
        return {
            externalId,
            quote: {
                type: QuoteType.HADITH,
                textAr: arEntry.body,
                sourceId: source.id,
                surahNumber: null,
                surahName: null,
                surahNameAr: null,
                ayahNumber: null,
                narrator: enEntry ? extractNarrator(enEntry.body) : null,
                narratorAr: extractNarratorAr(arEntry.body),
                grade,
                hadithReference: null,
                referenceNumber: Number.isInteger(referenceNumber) ? referenceNumber : null,
                referenceLabel: Number.isInteger(referenceNumber) ? null : String(hadith.hadithNumber),
                bookTitle: null,
                author: null,
                pageOrChapter: null,
                rawPayload: hadith,
            },
            translations,
        };
    }
    wrapAxiosError(err, collection, book) {
        if (err !== null &&
            typeof err === 'object' &&
            'response' in err &&
            err.response !== null &&
            typeof err.response === 'object' &&
            'status' in err.response) {
            const response = err.response;
            const retryAfterHeader = response.headers?.['retry-after'];
            const retryAfterMs = retryAfterHeader ? parseRetryAfter(retryAfterHeader) : undefined;
            return new ProviderHttpError(response.status, `sunnah.com ${collection}/book/${book} HTTP ${response.status}`, retryAfterMs);
        }
        return new ProviderHttpError(0, String(err));
    }
};
SunnahProvider = SunnahProvider_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [HttpService,
        ConfigService])
], SunnahProvider);
export { SunnahProvider };
function extractNarrator(body) {
    const match = /^Narrated\s+(.+?)(?::|—|that\s)/i.exec(body);
    return match?.[1]?.trim() ?? null;
}
function extractNarratorAr(body) {
    const match = /^(?:حدثنا|حدثني|أخبرنا|عن)\s+([\u0600-\u06FF\s]{3,40})(?:\s|،|قال)/u.exec(body);
    return match?.[1]?.trim() ?? null;
}
function parseRetryAfter(header) {
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds))
        return seconds * 1000;
    const date = new Date(header);
    if (!isNaN(date.getTime()))
        return Math.max(0, date.getTime() - Date.now());
    return 5_000;
}
//# sourceMappingURL=sunnah.provider.js.map