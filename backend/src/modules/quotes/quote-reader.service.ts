import { Injectable } from '@nestjs/common';
import { ExplanationKind, LinkReviewStatus, QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from './quotes.service.js';

/**
 * The reader's three tafsirs, in the owner's order (round 6, C-13): the fixed Source ids of
 * prisma/imports/approved-works.ts (the unit test checks they still match).
 */
export const READER_TAFSIRS = [
  { key: 'mukhtasar', sourceId: '10000000-0000-4000-8000-000000000025' }, // المختصر في تفسير القرآن الكريم
  { key: 'sadi', sourceId: '10000000-0000-4000-8000-000000000013' }, // تفسير السعدي
  { key: 'ibn-ashur', sourceId: '10000000-0000-4000-8000-000000000014' }, // التحرير والتنوير
] as const;

export type ReaderTafsirKey = (typeof READER_TAFSIRS)[number]['key'];

type ExplanationSource = { id: string; name: string; nameAr: string | null; type: string; author: string | null; authorAr: string | null };

export interface ReaderTafsirDto {
  key: ReaderTafsirKey;
  source: ExplanationSource;
  /** `en` only when that tafsir has an English edition (al-Mukhtasar); otherwise `ar`, to be shown inside lang="ar". */
  languageCode: string;
  /** The passage(s) covering the ayah, in order (Ibn Ashur's passages may cover several ayat). */
  entries: Array<{ id: string; ayahKey: string | null; text: string; reference: string | null }>;
}

export interface ReaderExplanationDto {
  id: string;
  kind: ExplanationKind;
  languageCode: string;
  text: string;
  reference: string | null;
  source: ExplanationSource;
}

/** GET /quotes/:id/reader. */
export interface QuoteReaderDto {
  quoteId: string;
  type: QuoteType;
  /**
   * «وجه التذكير» of the topic↔text link given as `linkId`, in the requested language; null when not written yet
   * (the reader then shows no section) or when no link was given. Never generated.
   */
  reminderAngle: { text: string; languageCode: 'ar' | 'en' } | null;
  /** Verses only: المختصر، السعدي، ابن عاشور, in that order, each present only when the database has it. */
  tafsirs: ReaderTafsirDto[];
  /** Hadith and other texts: sharh, fawaid, gharib, long sharh, as GET /quotes/:id/explanations. Empty for a verse. */
  explanations: ReaderExplanationDto[];
}

/**
 * The reader (round 6, C-13 / C-01n): text → «وجه التذكير» → the explanations inline. Same publication rules as
 * the quote page (a hidden text is 404). The link lookup is by primary key in the three link tables at once, and
 * only an ACCEPTED link of this very text counts.
 */
@Injectable()
export class QuoteReaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  async read(quoteId: string, lang: 'ar' | 'en', linkId?: string): Promise<{ data: QuoteReaderDto }> {
    const [{ quote, rows }, reminderAngle] = await Promise.all([
      this.quotes.publicExplanationRows(quoteId, lang),
      linkId ? this.reminderAngle(quoteId, linkId, lang) : Promise.resolve(null),
    ]);

    const tafsirs: ReaderTafsirDto[] = [];
    const explanations: ReaderExplanationDto[] = [];
    if (quote.type === QuoteType.QURAN_VERSE) {
      for (const tafsir of READER_TAFSIRS) {
        const own = rows.filter((row) => row.kind === ExplanationKind.TAFSIR && row.sourceId === tafsir.sourceId);
        const inLang = own.filter((row) => row.languageCode === lang);
        const chosen = inLang.length > 0 ? inLang : own.filter((row) => row.languageCode === 'ar');
        if (chosen.length === 0) continue;
        tafsirs.push({
          key: tafsir.key,
          source: chosen[0]!.source,
          languageCode: chosen[0]!.languageCode,
          entries: chosen.map((row) => ({ id: row.id, ayahKey: row.ayahKey, text: row.text, reference: row.reference })),
        });
      }
    } else {
      for (const row of rows) {
        if (row.kind === ExplanationKind.TAFSIR) continue;
        explanations.push({ id: row.id, kind: row.kind, languageCode: row.languageCode, text: row.text, reference: row.reference, source: row.source });
      }
    }
    return { data: { quoteId: quote.id, type: quote.type, reminderAngle, tafsirs, explanations } };
  }

  private async reminderAngle(quoteId: string, linkId: string, lang: 'ar' | 'en'): Promise<QuoteReaderDto['reminderAngle']> {
    const where = { id: linkId, quoteId, reviewStatus: LinkReviewStatus.ACCEPTED };
    const select = { reminderAngle: true, reminderAngleEn: true } as const;
    const [sin, deed, branch] = await Promise.all([
      this.prisma.sinQuote.findFirst({ where, select }),
      this.prisma.goodDeedQuote.findFirst({ where, select }),
      this.prisma.imanBranchQuote.findFirst({ where, select }),
    ]);
    const link = sin ?? deed ?? branch;
    // The English view shows only English a person wrote; it never falls back to the Arabic line.
    const text = lang === 'en' ? link?.reminderAngleEn : link?.reminderAngle;
    return text ? { text, languageCode: lang } : null;
  }
}
