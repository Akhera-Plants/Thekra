/**
 * al-quran-cloud.provider.ts
 *
 * Adapter for alquran.cloud API v1 (https://api.alquran.cloud/v1).
 * See content-pipeline-plan §2.2 for the full spec.
 * No auth required.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QuoteType } from '@prisma/client';
import type { Source } from '@prisma/client';
import type { AxiosRequestConfig } from 'axios';
import {
  type ContentProvider,
  type ProviderCursor,
  type ProviderBatch,
  type MappedQuote,
  ProviderHttpError,
  SkipRecordError,
} from './content-provider.interface.js';

// ─── API response shapes ─────────────────────────────────────────────────────

interface AlQuranAyah {
  number: number;       // global 1-6236 index
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
}

interface AlQuranEdition {
  identifier: string;
  language: string;
  name: string;
}

interface AlQuranSurahData {
  number: number;
  name: string;           // Arabic: سورة الحجرات
  englishName: string;    // Latin: Al-Hujuraat
  numberOfAyahs: number;
  ayahs: AlQuranAyah[];
  edition: AlQuranEdition;
}

interface AlQuranResponse {
  code: number;
  status: string;
  data: AlQuranSurahData;
}

// ─── Provider ────────────────────────────────────────────────────────────────

@Injectable()
export class AlQuranCloudProvider implements ContentProvider {
  readonly key = 'alquran.cloud';
  private readonly logger = new Logger(AlQuranCloudProvider.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return true; // No auth required
  }

  async fetchBatch(cursor: ProviderCursor): Promise<ProviderBatch> {
    const baseUrl = 'https://api.alquran.cloud/v1';
    const edition = 'quran-uthmani';

    const surahFrom = cursor.surahFrom ?? 1;
    const surahTo = cursor.surahTo ?? 114;
    const currentSurah = surahFrom + (cursor.page - 1);

    if (currentSurah > surahTo) {
      return { records: [], nextCursor: null };
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Thekra/1.0 (+contact@thekra.app)',
    };
    const axiosConfig: AxiosRequestConfig = { headers, timeout: 15_000 };
    const url = `${baseUrl}/surah/${currentSurah}/${edition}`;

    let resp: { data: AlQuranResponse };
    try {
      resp = await firstValueFrom(
        this.httpService.get<AlQuranResponse>(url, axiosConfig),
      );
    } catch (err: unknown) {
      throw this.wrapAxiosError(err, currentSurah);
    }

    if (resp.data.code !== 200) {
      throw new ProviderHttpError(resp.data.code, `alquran.cloud: ${resp.data.status}`);
    }

    const surahData = resp.data.data;
    const nextSurah = currentSurah + 1;
    const nextCursor: ProviderCursor | null =
      nextSurah <= surahTo
        ? { ...cursor, page: cursor.page + 1, surahFrom: nextSurah }
        : null;

    // Annotate each ayah with surah metadata so mapToQuote is pure
    const annotated = surahData.ayahs.map((a) => ({
      ...a,
      _surahNumber: surahData.number,
      _surahName: surahData.englishName,
      _surahNameAr: surahData.name,
    }));

    this.logger.log(
      `alquran.cloud: fetched surah ${currentSurah} (${surahData.numberOfAyahs} ayahs)`,
    );

    return { records: annotated, nextCursor };
  }

  mapToQuote(raw: unknown, source: Source): MappedQuote {
    const ayah = raw as AlQuranAyah & {
      _surahNumber: number;
      _surahName: string;
      _surahNameAr: string;
    };

    if (!ayah.text || ayah.text.trim() === '') {
      throw new SkipRecordError(
        `alquran.cloud ayah ${ayah._surahNumber}:${ayah.numberInSurah} has no Arabic text`,
      );
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
        rawPayload: ayah as object,
      },
      translations: [],
    };
  }

  private wrapAxiosError(err: unknown, surah: number): ProviderHttpError {
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
        `alquran.cloud surah ${surah} HTTP ${response.status}`,
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
