var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var QuranComProvider_1;
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QuoteType } from '@prisma/client';
import { ProviderHttpError, SkipRecordError, } from './content-provider.interface.js';
let QuranComProvider = QuranComProvider_1 = class QuranComProvider {
    httpService;
    config;
    key = 'quran.com';
    logger = new Logger(QuranComProvider_1.name);
    chapterCache = new Map();
    constructor(httpService, config) {
        this.httpService = httpService;
        this.config = config;
    }
    isConfigured() {
        return true;
    }
    async fetchBatch(cursor) {
        const baseUrl = (this.config.get('QURAN_API_BASE_URL') ?? 'https://api.quran.com/api/v4').replace(/\/$/, '');
        const token = this.config.get('QURAN_API_TOKEN');
        const translationIds = this.config.get('QURAN_TRANSLATION_IDS') ?? '131';
        const textField = this.config.get('QURAN_TEXT_FIELD') ??
            'text_uthmani';
        const surahTo = cursor.surahTo ?? 114;
        const currentSurah = cursor.surahFrom ?? 1;
        const page = cursor.page ?? 1;
        if (currentSurah > surahTo) {
            return { records: [], nextCursor: null };
        }
        if (this.chapterCache.size === 0) {
            await this.loadChapterCache(baseUrl, token);
        }
        const headers = {
            'User-Agent': 'Thekra/1.0 (+contact@thekra.app)',
        };
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
        const params = {
            language: 'ar',
            fields: textField,
            translations: translationIds,
            per_page: 50,
            page,
        };
        const config = { headers, params, timeout: 15_000 };
        const url = `${baseUrl}/verses/by_chapter/${currentSurah}`;
        let resp;
        try {
            resp = await firstValueFrom(this.httpService.get(url, config));
        }
        catch (err) {
            throw this.wrapAxiosError(err);
        }
        const { verses, pagination } = resp.data;
        const nextCursor = pagination.next_page !== null
            ? { ...cursor, surahFrom: currentSurah, page: pagination.next_page }
            : currentSurah + 1 <= surahTo
                ? { ...cursor, surahFrom: currentSurah + 1, page: 1 }
                : null;
        this.logger.log(`quran.com: fetched surah ${currentSurah}, ${verses.length} verses (page ${pagination.current_page}/${pagination.total_pages})`);
        return { records: verses, nextCursor };
    }
    mapToQuote(raw, source) {
        const verse = raw;
        const textField = this.config.get('QURAN_TEXT_FIELD') ?? 'text_uthmani';
        const textAr = textField === 'text_imlaei' ? verse.text_imlaei : verse.text_uthmani;
        if (!textAr || textAr.trim() === '') {
            throw new SkipRecordError(`quran.com verse ${verse.verse_key} has no Arabic text (field: ${textField})`);
        }
        const chapter = this.chapterCache.get(verse.chapter_id);
        const translations = (verse.translations ?? []).map((t) => ({
            languageCode: 'en',
            text: t.text,
        }));
        const seenLangs = new Set();
        const deduped = translations.filter((t) => {
            if (seenLangs.has(t.languageCode))
                return false;
            seenLangs.add(t.languageCode);
            return true;
        });
        return {
            externalId: verse.verse_key,
            quote: {
                type: QuoteType.QURAN_VERSE,
                textSource: 'DIGITAL',
                textAr,
                sourceId: source.id,
                surahNumber: verse.chapter_id,
                surahName: chapter?.nameSimple ?? null,
                surahNameAr: chapter?.nameArabic ?? null,
                ayahNumber: verse.verse_number,
                narrator: null,
                narratorAr: null,
                grade: null,
                hadithReference: null,
                bookTitle: null,
                author: null,
                pageOrChapter: null,
                rawPayload: verse,
            },
            translations: deduped,
        };
    }
    async loadChapterCache(baseUrl, token) {
        const headers = {
            'User-Agent': 'Thekra/1.0 (+contact@thekra.app)',
        };
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
        try {
            const resp = await firstValueFrom(this.httpService.get(`${baseUrl}/chapters?language=ar`, { headers, timeout: 15_000 }));
            for (const c of resp.data.chapters) {
                this.chapterCache.set(c.chapter_number, {
                    nameSimple: c.name_simple,
                    nameArabic: c.name_arabic,
                });
            }
        }
        catch {
            this.logger.warn('quran.com: failed to load chapter cache; surahName will be null');
        }
    }
    wrapAxiosError(err) {
        if (err !== null &&
            typeof err === 'object' &&
            'response' in err &&
            err.response !== null &&
            typeof err.response === 'object' &&
            'status' in err.response) {
            const response = err.response;
            const retryAfterHeader = response.headers?.['retry-after'];
            const retryAfterMs = retryAfterHeader
                ? parseRetryAfter(retryAfterHeader)
                : undefined;
            return new ProviderHttpError(response.status, `quran.com HTTP ${response.status}`, retryAfterMs);
        }
        return new ProviderHttpError(0, String(err));
    }
};
QuranComProvider = QuranComProvider_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [HttpService,
        ConfigService])
], QuranComProvider);
export { QuranComProvider };
function parseRetryAfter(header) {
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds))
        return seconds * 1000;
    const date = new Date(header);
    if (!isNaN(date.getTime()))
        return Math.max(0, date.getTime() - Date.now());
    return 5_000;
}
//# sourceMappingURL=quran-com.provider.js.map