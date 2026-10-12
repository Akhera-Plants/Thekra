/**
 * quran-com.provider.ts
 *
 * Adapter for the Quran.com API v4 (https://api.quran.com/api/v4).
 * See content-pipeline-plan §2.1 for the full spec.
 *
 * In **tests** this class is never instantiated directly — the whole
 * ContentProvider is injected as a stub that returns fixture JSON.
 * Real HTTP is only reached when `SYNC_ENABLED=true` AND the process has
 * network access.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QuoteType } from '@prisma/client';
import type { Source } from '@prisma/client';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  type ContentProvider,
  type ProviderCursor,
  type ProviderBatch,
  type MappedQuote,
  ProviderHttpError,
  SkipRecordError,
} from './content-provider.interface.js';

// ─── API response shapes ─────────────────────────────────────────────────────

interface QuranComVerse {
  id: number;
  verse_number: number;
  verse_key: string;
  chapter_id: number;
  text_uthmani?: string;
  text_imlaei?: string;
  juz_number?: number;
  page_number?: number;
  translations?: Array<{ id: number; resource_id: number; text: string }>;
}

interface QuranComPagination {
  per_page: number;
  current_page: number;
  next_page: number | null;
  total_pages: number;
  total_records: number;
}

interface QuranComVersesResponse {
  verses: QuranComVerse[];
  pagination: QuranComPagination;
}

interface QuranComChapter {
  id: number;
  chapter_number: number;
  name_simple: string;
  name_arabic: string;
}

// ─── Provider ────────────────────────────────────────────────────────────────

@Injectable()
export class QuranComProvider implements ContentProvider {
  readonly key = 'quran.com';
  private readonly logger = new Logger(QuranComProvider.name);

  /** Loaded once per run and reused across pages. */
  private chapterCache: Map<number, { nameSimple: string; nameArabic: string }> =
    new Map();

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    // No mandatory key for quran.com; optional token is fine to be absent
    return true;
  }

  async fetchBatch(cursor: ProviderCursor): Promise<ProviderBatch> {
    const baseUrl =
      (this.config.get<string>('QURAN_API_BASE_URL') ?? 'https://api.quran.com/api/v4').replace(
        /\/$/,
        '',
      );
    const token = this.config.get<string>('QURAN_API_TOKEN');
    const translationIds = this.config.get<string>('QURAN_TRANSLATION_IDS') ?? '131';
    const textField =
      (this.config.get<string>('QURAN_TEXT_FIELD') as 'text_uthmani' | 'text_imlaei') ??
      'text_uthmani';

    const surahTo = cursor.surahTo ?? 114;
    const currentSurah = cursor.surahFrom ?? 1;
    const page = cursor.page ?? 1;
    if (currentSurah > surahTo) {
      return { records: [], nextCursor: null };
    }

    // Ensure chapter metadata is loaded
    if (this.chapterCache.size === 0) {
      await this.loadChapterCache(baseUrl, token);
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Thekra/1.0 (+contact@thekra.app)',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params: Record<string, string | number> = {
      language: 'ar',
      fields: textField,
      translations: translationIds,
      per_page: 50,
      page,
    };

    const config: AxiosRequestConfig = { headers, params, timeout: 15_000 };
    const url = `${baseUrl}/verses/by_chapter/${currentSurah}`;

    let resp: AxiosResponse<QuranComVersesResponse>;
    try {
      resp = await firstValueFrom(
        this.httpService.get<QuranComVersesResponse>(url, config),
      );
    } catch (err: unknown) {
      throw this.wrapAxiosError(err);
    }

    const { verses, pagination } = resp.data;

    const nextCursor: ProviderCursor | null =
      pagination.next_page !== null
        ? { ...cursor, surahFrom: currentSurah, page: pagination.next_page }
        : currentSurah + 1 <= surahTo
          ? { ...cursor, surahFrom: currentSurah + 1, page: 1 }
          : null;

    this.logger.log(
      `quran.com: fetched surah ${currentSurah}, ${verses.length} verses (page ${pagination.current_page}/${pagination.total_pages})`,
    );

    return { records: verses, nextCursor };
  }

  mapToQuote(raw: unknown, source: Source): MappedQuote {
    const verse = raw as QuranComVerse;
    const textField = this.config.get<string>('QURAN_TEXT_FIELD') ?? 'text_uthmani';
    const textAr =
      textField === 'text_imlaei' ? verse.text_imlaei : verse.text_uthmani;

    if (!textAr || textAr.trim() === '') {
      throw new SkipRecordError(
        `quran.com verse ${verse.verse_key} has no Arabic text (field: ${textField})`,
      );
    }

    const chapter = this.chapterCache.get(verse.chapter_id);

    const translations = (verse.translations ?? []).map((t) => ({
      languageCode: 'en', // resource 131 is English; resolved from catalogue in real use
      text: t.text,
    }));

    // Keep only first translation per language (first configured resource_id wins)
    const seenLangs = new Set<string>();
    const deduped = translations.filter((t) => {
      if (seenLangs.has(t.languageCode)) return false;
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
        rawPayload: verse as object,
      },
      translations: deduped,
    };
  }

  private async loadChapterCache(
    baseUrl: string,
    token: string | undefined,
  ): Promise<void> {
    const headers: Record<string, string> = {
      'User-Agent': 'Thekra/1.0 (+contact@thekra.app)',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const resp = await firstValueFrom(
        this.httpService.get<{ chapters: QuranComChapter[] }>(
          `${baseUrl}/chapters?language=ar`,
          { headers, timeout: 15_000 },
        ),
      );
      for (const c of resp.data.chapters) {
        this.chapterCache.set(c.chapter_number, {
          nameSimple: c.name_simple,
          nameArabic: c.name_arabic,
        });
      }
    } catch {
      this.logger.warn('quran.com: failed to load chapter cache; surahName will be null');
    }
  }

  private wrapAxiosError(err: unknown): ProviderHttpError {
    if (
      err !== null &&
      typeof err === 'object' &&
      'response' in err &&
      err.response !== null &&
      typeof err.response === 'object' &&
      'status' in err.response
    ) {
      const response = err.response as { status: number; headers?: Record<string, string> };
      const retryAfterHeader = response.headers?.['retry-after'];
      const retryAfterMs = retryAfterHeader
        ? parseRetryAfter(retryAfterHeader)
        : undefined;
      return new ProviderHttpError(
        response.status,
        `quran.com HTTP ${response.status}`,
        retryAfterMs,
      );
    }
    return new ProviderHttpError(0, String(err));
  }
}

function parseRetryAfter(header: string): number {
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  const date = new Date(header);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return 5_000;
}
