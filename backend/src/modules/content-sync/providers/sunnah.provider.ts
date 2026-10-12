/**
 * sunnah.provider.ts
 *
 * Adapter for the Sunnah.com API v1 (https://api.sunnah.com/v1).
 * See content-pipeline-plan §2.3 for the full spec.
 *
 * REQUIRES `SUNNAH_API_KEY` env var.  If absent, `isConfigured()` returns false
 * and the executor refuses to start the run with 422 PROVIDER_NOT_CONFIGURED.
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

interface SunnahHadithEntry {
  lang: string;
  chapterNumber: string;
  chapterTitle: string;
  urn: number;
  body: string;
  grades: Array<{ graded_by: string; grade: string }>;
  reference: { book: number; hadith: number };
}

interface SunnahHadith {
  collection: string;
  bookNumber: string;
  chapterId: string;
  hadithNumber: string;
  hadith: SunnahHadithEntry[];
}

interface SunnahListResponse {
  hadiths?: SunnahHadith[];
  data?: SunnahHadith[];
  total?: number;
  limit?: number;
  next?: string | null;
  previous?: string | null;
}

// ─── Provider ────────────────────────────────────────────────────────────────

@Injectable()
export class SunnahProvider implements ContentProvider {
  readonly key = 'sunnah.com';
  private readonly logger = new Logger(SunnahProvider.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    const key = this.config.get<string>('SUNNAH_API_KEY');
    return !!key && key.trim().length > 0;
  }

  async fetchBatch(cursor: ProviderCursor): Promise<ProviderBatch> {
    const key = this.config.get<string>('SUNNAH_API_KEY');
    if (!key) throw new ProviderHttpError(0, 'SUNNAH_API_KEY not configured');

    const baseUrl = 'https://api.sunnah.com/v1';
    const collection = cursor.collection ?? 'bukhari';
    const bookFrom = cursor.bookFrom ?? 1;
    const bookNumber = bookFrom + (cursor.page - 1);

    const headers: Record<string, string> = {
      'X-API-Key': key,
      'User-Agent': 'Thekra/1.0 (+contact@thekra.app)',
    };
    const axiosConfig: AxiosRequestConfig = { headers, params: { limit: 50, page: 1 }, timeout: 15_000 };

    const url = `${baseUrl}/collections/${collection}/books/${bookNumber}/hadiths`;
    let resp: { data: SunnahListResponse };
    try {
      resp = await firstValueFrom(
        this.httpService.get<SunnahListResponse>(url, axiosConfig),
      );
    } catch (err: unknown) {
      throw this.wrapAxiosError(err, collection, bookNumber);
    }

    const hadiths: SunnahHadith[] = (resp.data.hadiths ?? resp.data.data ?? []) as SunnahHadith[];
    const bookTo = cursor.bookTo;
    const nextBook = bookNumber + 1;
    const nextCursor: ProviderCursor | null =
      bookTo === undefined || nextBook <= bookTo
        ? { ...cursor, page: cursor.page + 1, bookFrom: nextBook }
        : null;

    this.logger.log(
      `sunnah.com: fetched ${collection} book ${bookNumber} — ${hadiths.length} hadiths`,
    );

    return { records: hadiths, nextCursor };
  }

  mapToQuote(raw: unknown, source: Source): MappedQuote {
    const hadith = raw as SunnahHadith;
    const arEntry = hadith.hadith.find((h) => h.lang === 'ar');
    if (!arEntry || !arEntry.body || arEntry.body.trim() === '') {
      throw new SkipRecordError(
        `sunnah.com ${hadith.collection}:${hadith.hadithNumber} has no Arabic text`,
      );
    }

    const enEntry = hadith.hadith.find((h) => h.lang === 'en');
    const allGrades = hadith.hadith.flatMap((h) => h.grades.map((g) => g.grade));
    const { grade, unmappedStrings } = resolveWeakestGrade(allGrades);
    if (unmappedStrings.length > 0) {
      this.logger.warn(
        { collection: hadith.collection, hadithNumber: hadith.hadithNumber, unmappedStrings },
        'sunnah.com: unrecognised grade strings — mapped to UNGRADED',
      );
    }

    const externalId = `${hadith.collection}:${hadith.hadithNumber}`;
    const referenceNumber = Number.parseInt(String(hadith.hadithNumber), 10);

    const translations: { languageCode: string; text: string }[] = enEntry?.body
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
        rawPayload: hadith as object,
      },
      translations,
    };
  }

  private wrapAxiosError(err: unknown, collection: string, book: number): ProviderHttpError {
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
        `sunnah.com ${collection}/book/${book} HTTP ${response.status}`,
        retryAfterMs,
      );
    }
    return new ProviderHttpError(0, String(err));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Heuristic: extract narrator from the English hadith body.
 * Pattern: "Narrated X:" at the start of the body.
 */
function extractNarrator(body: string): string | null {
  const match = /^Narrated\s+(.+?)(?::|—|that\s)/i.exec(body);
  return match?.[1]?.trim() ?? null;
}

/**
 * Heuristic: extract narrator from Arabic hadith body.
 * Pattern: "حدثنا X" or "عن X" at the start.
 * If parsing is not confident, return null (a wrong narrator is worse than missing one).
 */
function extractNarratorAr(body: string): string | null {
  const match = /^(?:حدثنا|حدثني|أخبرنا|عن)\s+([\u0600-\u06FF\s]{3,40})(?:\s|،|قال)/u.exec(
    body,
  );
  return match?.[1]?.trim() ?? null;
}

function parseRetryAfter(header: string): number {
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  const date = new Date(header);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return 5_000;
}
