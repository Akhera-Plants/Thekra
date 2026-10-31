import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { QuoteDto } from '../../common/mappers/quote.mapper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { topicNames } from '../taxonomy/topic-pairs.js';
import { nameOfAllahBySlug, namesOfAllah, nameWordPattern, type NameLinkKind, type NameOfAllah } from './names-of-allah.js';

/** At most this many further verses on a name page. */
export const OTHER_VERSES_MAX = 10;
/** Candidates read before the reader gate drops unpublished rows (verses are almost always published). */
const CANDIDATES = 40;

export interface NameListItemDto {
  number: number;
  slug: string;
  nameAr: string;
  ref: string;
}

export interface NameLinkDto {
  kind: NameLinkKind;
  slug: string;
  nameAr: string;
  name: string;
}

export interface NameDetailDto extends NameListItemDto {
  meaningAr: string;
  meaningEn: string;
  /** The meanings and links are pending the sheikh («قيد المراجعة»). */
  review: string;
  /** The primary verse (yaml quoteId) under the reader gate; null when it is not published here. */
  verse: QuoteDto | null;
  links: NameLinkDto[];
  /** Up to 10 more published verses that contain the word, by surah/ayah, without the primary verse. */
  otherVerses: QuoteDto[];
  prev: NameListItemDto | null;
  next: NameListItemDto | null;
}

const ACTION_NAMES: Record<string, { ar: string; en: string }> = {
  'leave-sin': { ar: 'تخفَّف', en: 'Lighten' },
};

function listItem(name: NameOfAllah): NameListItemDto {
  return { number: name.number, slug: name.slug, nameAr: name.nameAr, ref: name.ref };
}

@Injectable()
export class NamesOfAllahService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  findAll(): { data: NameListItemDto[] } {
    return { data: namesOfAllah().names.map(listItem) };
  }

  async findBySlug(slug: string, lang: 'ar' | 'en'): Promise<{ data: NameDetailDto }> {
    const name = nameOfAllahBySlug(slug);
    if (!name) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Name not found' });
    }
    const file = namesOfAllah();
    const [verse, otherVerses] = await Promise.all([
      this.quotes.findPublishedByIds([name.quoteId], lang).then((items) => items[0] ?? null),
      this.otherVerses(name, lang),
    ]);
    const index = name.number - 1;
    const prev = file.names[index - 1];
    const next = file.names[index + 1];
    return {
      data: {
        ...listItem(name),
        meaningAr: name.meaningAr,
        meaningEn: name.meaningEn,
        review: file.review,
        verse,
        links: name.links.map((link) => {
          const names = link.kind === 'action' ? ACTION_NAMES[link.slug] : topicNames(link.slug);
          return { kind: link.kind, slug: link.slug, nameAr: names?.ar ?? link.slug, name: names?.en ?? link.slug };
        }),
        otherVerses,
        prev: prev ? listItem(prev) : null,
        next: next ? listItem(next) : null,
      },
    };
  }

  /** Verses whose normalized text contains the name as a whole word (see nameWordPattern), published only. */
  private async otherVerses(name: NameOfAllah, lang: 'ar' | 'en'): Promise<QuoteDto[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id
      FROM   "Quote"
      WHERE  type = 'QURAN_VERSE'
        AND  id <> ${name.quoteId}
        AND  thekra_normalize_ar("textAr") ~ ${nameWordPattern(name)}
      ORDER  BY "surahNumber" ASC NULLS LAST, "ayahNumber" ASC NULLS LAST, id ASC
      LIMIT  ${CANDIDATES}
    `);
    const items = await this.quotes.findPublishedByIds(
      rows.map((row) => row.id),
      lang,
    );
    return items.slice(0, OTHER_VERSES_MAX);
  }
}
