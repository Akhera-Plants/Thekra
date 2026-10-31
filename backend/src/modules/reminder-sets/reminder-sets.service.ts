import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { ReminderSet } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { QuoteDto } from '../quotes/entities/quote.entity.js';
import type { CreateReminderSetDto, UpdateReminderSetDto } from './dto/reminder-set.dto.js';
import { eligibleQuoteClause } from './reminder-set-rules.js';

export interface ReminderSetSummaryDto {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  sortOrder: number;
  published: boolean;
  itemCount: number;
}

export interface ReminderSetDetailDto extends ReminderSetSummaryDto {
  /** Public read: the texts that pass the reader gate today, in order (through the shared quote serializer). */
  items: QuoteDto[];
}

export interface AdminReminderSetDto extends ReminderSetSummaryDto {
  /** Stored ids in order (the desk shows which ones are no longer public). */
  quoteIds: string[];
}

const notFound = () => new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Reminder set not found' });

/**
 * «مجموعات التذكير» (redesign §4.6). The desk writes sets and their ordered quote ids; every id is checked on write
 * against {@link eligibleQuoteClause}. The public read lists published sets and returns each set's texts through
 * `QuotesService.findPublishedByIds` (the reader gate again, so a text that loses its publication drops out).
 */
@Injectable()
export class ReminderSetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  private summary(row: ReminderSet, itemCount: number): ReminderSetSummaryDto {
    return {
      id: row.id,
      slug: row.slug,
      titleAr: row.titleAr,
      titleEn: row.titleEn,
      sortOrder: row.sortOrder,
      published: row.published,
      itemCount,
    };
  }

  /** Published sets with their texts, by `sortOrder`. Sets whose texts are all hidden are left out. */
  async findPublished(locale: 'ar' | 'en'): Promise<{ data: ReminderSetDetailDto[] }> {
    const rows = await this.prisma.reminderSet.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
    });
    const allIds = [...new Set(rows.flatMap((row) => row.items.map((item) => item.quoteId)))];
    const quotes = await this.quotes.findPublishedByIds(allIds, locale);
    const byId = new Map(quotes.map((quote) => [quote.id, quote]));
    const data = rows.flatMap((row) => {
      const items = row.items.flatMap((item) => byId.get(item.quoteId) ?? []);
      return items.length > 0 ? [{ ...this.summary(row, items.length), items }] : [];
    });
    return { data };
  }

  async findPublishedBySlug(slug: string, locale: 'ar' | 'en'): Promise<{ data: ReminderSetDetailDto }> {
    const row = await this.prisma.reminderSet.findFirst({
      where: { slug, published: true },
      include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
    });
    if (!row) throw notFound();
    const items = await this.quotes.findPublishedByIds(
      row.items.map((item) => item.quoteId),
      locale,
    );
    return { data: { ...this.summary(row, items.length), items } };
  }

  // ── Desk ───────────────────────────────────────────────────────────────────

  private toAdmin(row: ReminderSet & { items: { quoteId: string }[] }): AdminReminderSetDto {
    return { ...this.summary(row, row.items.length), quoteIds: row.items.map((item) => item.quoteId) };
  }

  async adminList(): Promise<{ data: AdminReminderSetDto[] }> {
    const rows = await this.prisma.reminderSet.findMany({
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
    });
    return { data: rows.map((row) => this.toAdmin(row)) };
  }

  async adminFind(id: string): Promise<{ data: AdminReminderSetDto & { items: QuoteDto[] } }> {
    const row = await this.prisma.reminderSet.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
    });
    if (!row) throw notFound();
    const items = await this.quotes.findPublishedByIds(
      row.items.map((item) => item.quoteId),
      'ar',
    );
    return { data: { ...this.toAdmin(row), items } };
  }

  async adminCreate(dto: CreateReminderSetDto): Promise<AdminReminderSetDto> {
    // A duplicate slug is P2002 → 409 (global filter).
    const row = await this.prisma.reminderSet.create({
      data: { slug: dto.slug, titleAr: dto.titleAr, titleEn: dto.titleEn, sortOrder: dto.sortOrder ?? 0, published: dto.published ?? false },
      include: { items: { select: { quoteId: true } } },
    });
    return this.toAdmin(row);
  }

  async adminUpdate(id: string, dto: UpdateReminderSetDto): Promise<AdminReminderSetDto> {
    const existing = await this.prisma.reminderSet.findUnique({ where: { id } });
    if (!existing) throw notFound();
    const row = await this.prisma.reminderSet.update({
      where: { id },
      data: dto,
      include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
    });
    return this.toAdmin(row);
  }

  async adminDelete(id: string): Promise<void> {
    const existing = await this.prisma.reminderSet.findUnique({ where: { id } });
    if (!existing) throw notFound();
    await this.prisma.reminderSet.delete({ where: { id } });
  }

  /** Ids among `ids` that a set may not hold (unknown, unpublished, athar, weak…), in the given order. */
  async ineligibleIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const ok = await this.prisma.quote.findMany({ where: eligibleQuoteClause(ids), select: { id: true } });
    const okIds = new Set(ok.map((row) => row.id));
    return ids.filter((id) => !okIds.has(id));
  }

  /** Replaces the set's ordered texts. 422 with the refused ids when any id is not a published verse or sahih/hasan hadith. */
  async adminSetItems(id: string, quoteIds: readonly string[]): Promise<AdminReminderSetDto> {
    const existing = await this.prisma.reminderSet.findUnique({ where: { id } });
    if (!existing) throw notFound();
    const refused = await this.ineligibleIds(quoteIds);
    if (refused.length > 0) {
      throw new UnprocessableEntityException({
        code: 'REMINDER_SET_QUOTE_NOT_ALLOWED',
        message: 'Only published Quran verses and sahih/hasan hadith may be added',
        details: { quoteIds: refused },
      });
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.reminderSetItem.deleteMany({ where: { setId: id } });
      if (quoteIds.length > 0) {
        await tx.reminderSetItem.createMany({ data: quoteIds.map((quoteId, position) => ({ setId: id, quoteId, position })) });
      }
      return tx.reminderSet.update({
        where: { id },
        data: { updatedAt: new Date() },
        include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
      });
    });
    return this.toAdmin(row);
  }
}
