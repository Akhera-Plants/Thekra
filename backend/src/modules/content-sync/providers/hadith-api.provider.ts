/**
 * hadith-api.provider.ts
 *
 * Adapter for HadithAPI.com (https://hadithapi.com/api).
 * See content-pipeline-plan §2.4 for the full spec.
 *
 * REQUIRES `HADITH_API_KEY` query-parameter key.
 * The key is NEVER stored in `rawPayload` — it is stripped before persisting.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QuoteType } from '@prisma/client';
import type { Source } from '@prisma/client';
import type { AxiosRequestConfig } from 'axios';
import { resolveWeakestGrade } from '../mappers/grade.mapper.js';
import {
  type ContentProvider,
  type ProviderCursor,
  type ProviderBatch,
  type MappedQuote,
  ProviderHttpError,
  SkipRecordError,
} from './content-provider.interface.js';

// ─── API response shapes ─────────────────────────────────────────────────────

interface HadithApiBook {
  bookName: string;
  writerName: string;
  bookSlug: string;
  aboutWriter: string | null;
  writerDied: string;
}

interface HadithApiChapter {
  chapterNumber: string;
  chapterEnglish: string;
  chapterArabic: string;
  bookSlug: string;
}

interface HadithApiRecord {
  id: number;
  hadithNumber: string;
  englishNarrator: string;
  hadithEnglish: string;
  hadithArabic: string;
  headingArabic: string;
  headingEnglish: string;
  status: string;
  bookSlug: string;
  volume: string;
  book: HadithApiBook;
  chapter: HadithApiChapter;
}

interface HadithApiResponse {
  hadiths: {
    current_page: number;
    total: number;
    per_page: number;
    last_page: number;
    data: HadithApiRecord[];
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────

@Injectable()
export class HadithApiProvider implements ContentProvider {
  readonly key = 'hadithapi.com';
  private readonly logger = new Logger(HadithApiProvider.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    const key = this.config.get<string>('HADITH_API_KEY');
    return !!key && key.trim().length > 0;
  }

  async fetchBatch(cursor: ProviderCursor): Promise<ProviderBatch> {
    const apiKey = this.config.get<string>('HADITH_API_KEY');
    if (!apiKey) throw new ProviderHttpError(0, 'HADITH_API_KEY not configured');

    const baseUrl = 'https://hadithapi.com/api';
    const collection = cursor.collection ?? 'sahih-bukhari';

    // params — strip the key from rawPayload later
    const params: Record<string, string | number> = {
      apiKey,
      book: collection,
      paginate: 25,
      page: cursor.page,
    };

    const headers: Record<string, string> = {
      'User-Agent': 'Thekra/1.0 (+contact@thekra.app)',
    };
    const axiosConfig: AxiosRequestConfig = { headers, params, timeout: 15_000 };
    const url = `${baseUrl}/hadiths`;

    let resp: { data: HadithApiResponse };
    try {
      resp = await firstValueFrom(
        this.httpService.get<HadithApiResponse>(url, axiosConfig),
      );
    } catch (err: unknown) {
      throw this.wrapAxiosError(err, collection, cursor.page);
    }

    const { hadiths } = resp.data;
    const hasMore = hadiths.current_page < hadiths.last_page;
    const nextCursor: ProviderCursor | null = hasMore
      ? { ...cursor, page: cursor.page + 1 }
      : null;

    this.logger.log(
      `hadithapi.com: fetched ${collection} page ${hadiths.current_page}/${hadiths.last_page} — ${hadiths.data.length} hadiths`,
    );

    return { records: hadiths.data, nextCursor };
  }

  mapToQuote(raw: unknown, source: Source): MappedQuote {
    const h = raw as HadithApiRecord;

    if (!h.hadithArabic || h.hadithArabic.trim() === '') {
      throw new SkipRecordError(
        `hadithapi.com ${h.bookSlug}:${h.hadithNumber} has no Arabic text`,
      );
    }

    const { grade, unmappedStrings } = resolveWeakestGrade([h.status]);
    if (unmappedStrings.length > 0) {
      this.logger.warn(
        { book: h.bookSlug, hadithNumber: h.hadithNumber, unmappedStrings },
        'hadithapi.com: unrecognised status string — mapped to UNGRADED',
      );
    }

    const externalId = `${h.bookSlug}:${h.hadithNumber}`;
    const referenceNumber = Number.parseInt(String(h.hadithNumber), 10);

    // Strip narrator prefix ("Narrated X:") from englishNarrator
    const narrator = h.englishNarrator
      ? h.englishNarrator.replace(/^Narrated\s*/i, '').replace(/:$/, '').trim() || null
      : null;

    // Strip API key from rawPayload — never persist credentials
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
        rawPayload: safePayload as object,
      },
      translations: h.hadithEnglish
        ? [{ languageCode: 'en', text: h.hadithEnglish }]
        : [],
    };
  }

  private wrapAxiosError(err: unknown, collection: string, page: number): ProviderHttpError {
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
      const retryAfterMs = retryAfterHeader ? parseRetryAfter(retryAfterHeader) : undefined;
      return new ProviderHttpError(
        response.status,
        `hadithapi.com ${collection} page ${page} HTTP ${response.status}`,
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
