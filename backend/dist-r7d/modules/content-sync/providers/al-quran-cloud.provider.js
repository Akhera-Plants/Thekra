var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AlQuranCloudProvider_1;
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QuoteType } from '@prisma/client';
import { ProviderHttpError, SkipRecordError, } from './content-provider.interface.js';
let AlQuranCloudProvider = AlQuranCloudProvider_1 = class AlQuranCloudProvider {
    httpService;
    config;
    key = 'alquran.cloud';
    logger = new Logger(AlQuranCloudProvider_1.name);
    constructor(httpService, config) {
        this.httpService = httpService;
        this.config = config;
    }
    isConfigured() {
        return true;
    }
    async fetchBatch(cursor) {
        const baseUrl = 'https://api.alquran.cloud/v1';
        const edition = 'quran-uthmani';
        const surahFrom = cursor.surahFrom ?? 1;
        const surahTo = cursor.surahTo ?? 114;
        const currentSurah = surahFrom + (cursor.page - 1);
        if (currentSurah > surahTo) {
            return { records: [], nextCursor: null };
        }
        const headers = {
            'User-Agent': 'Thekra/1.0 (+contact@thekra.app)',
        };
        const axiosConfig = { headers, timeout: 15_000 };
        const url = `${baseUrl}/surah/${currentSurah}/${edition}`;
        let resp;
        try {
            resp = await firstValueFrom(this.httpService.get(url, axiosConfig));
        }
        catch (err) {
            throw this.wrapAxiosError(err, currentSurah);
        }
        if (resp.data.code !== 200) {
            throw new ProviderHttpError(resp.data.code, `alquran.cloud: ${resp.data.status}`);
        }
        const surahData = resp.data.data;
        const nextSurah = currentSurah + 1;
        const nextCursor = nextSurah <= surahTo
            ? { ...cursor, page: cursor.page + 1, surahFrom: nextSurah }
            : null;
        const annotated = surahData.ayahs.map((a) => ({
            ...a,
            _surahNumber: surahData.number,
            _surahName: surahData.englishName,
            _surahNameAr: surahData.name,
        }));
        this.logger.log(`alquran.cloud: fetched surah ${currentSurah} (${surahData.numberOfAyahs} ayahs)`);
        return { records: annotated, nextCursor };
    }
    mapToQuote(raw, source) {
        const ayah = raw;
        if (!ayah.text || ayah.text.trim() === '') {
            throw new SkipRecordError(`alquran.cloud ayah ${ayah._surahNumber}:${ayah.numberInSurah} has no Arabic text`);
        }
        const externalId = `${ayah._surahNumber}:${ayah.numberInSurah}`;
        return {
            externalId,
            quote: {
                type: QuoteType.QURAN_VERSE,
                textAr: ayah.text,
                sourceId: source.id,
                surahNumber: ayah._surahNumber,
                surahName: ayah._surahName,
                surahNameAr: ayah._surahNameAr,
                ayahNumber: ayah.numberInSurah,
                narrator: null,
                narratorAr: null,
                grade: null,
                hadithReference: null,
                bookTitle: null,
                author: null,
                pageOrChapter: null,
                rawPayload: ayah,
            },
            translations: [],
        };
    }
    wrapAxiosError(err, surah) {
        if (err !== null &&
            typeof err === 'object' &&
            'response' in err &&
            err.response !== null &&
            typeof err.response === 'object' &&
            'status' in err.response) {
            const response = err.response;
            const retryAfterHeader = response.headers?.['retry-after'];
            const retryAfterMs = retryAfterHeader ? parseRetryAfter(retryAfterHeader) : undefined;
            return new ProviderHttpError(response.status, `alquran.cloud surah ${surah} HTTP ${response.status}`, retryAfterMs);
        }
        return new ProviderHttpError(0, String(err));
    }
};
AlQuranCloudProvider = AlQuranCloudProvider_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [HttpService,
        ConfigService])
], AlQuranCloudProvider);
export { AlQuranCloudProvider };
function parseRetryAfter(header) {
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds))
        return seconds * 1000;
    const date = new Date(header);
    if (!isNaN(date.getTime()))
        return Math.max(0, date.getTime() - Date.now());
    return 5_000;
}
//# sourceMappingURL=al-quran-cloud.provider.js.map