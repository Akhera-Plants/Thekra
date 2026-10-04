import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QuoteType } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import type { BulkLinkGoodDeedQuotesDto } from './dto/bulk-link-good-deed-quotes.dto.js';
import type { BulkLinkSinQuotesDto } from './dto/bulk-link-sin-quotes.dto.js';
import type { GoodDeedQuotesAdminQueryDto } from './dto/good-deed-quotes-admin-query.dto.js';
import type { LinkGoodDeedQuoteDto } from './dto/link-good-deed-quote.dto.js';
import type { LinkSinQuoteDto } from './dto/link-sin-quote.dto.js';
import type { SinQuotesAdminQueryDto } from './dto/sin-quotes-admin-query.dto.js';
import type { UpdateGoodDeedLinkDto } from './dto/update-good-deed-link.dto.js';
import type { UpdateSinLinkDto } from './dto/update-sin-link.dto.js';
import type { GoodDeedLinkDto } from './entities/good-deed-link.entity.js';
import type { SinLinkDto } from './entities/sin-link.entity.js';

const SIN_LINK_INCLUDE = {
  sin: { select: { slug: true, name: true, nameAr: true } },
  quote: { select: { id: true, type: true, textAr: true } },
} as const;

const GOOD_DEED_LINK_INCLUDE = {
  goodDeed: { select: { slug: true, name: true, nameAr: true } },
  quote: { select: { id: true, type: true, textAr: true } },
} as const;

@Injectable()
export class ClassificationService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Sin-Quote links ────────────────────────────────────────────────────────

  async linkSinQuote(dto: LinkSinQuoteDto): Promise<{ created: boolean; link: SinLinkDto }> {
    await this.assertSinExists(dto.sinId);
    await this.assertQuoteExistsAndGradeAllowed(dto.quoteId);

    const existing = await this.prisma.sinQuote.findUnique({
      where: { sinId_quoteId: { sinId: dto.sinId, quoteId: dto.quoteId } },
    });

    const link = await this.prisma.sinQuote.upsert({
      where: { sinId_quoteId: { sinId: dto.sinId, quoteId: dto.quoteId } },
      create: {
        sinId: dto.sinId,
        quoteId: dto.quoteId,
        relevanceScore: dto.relevanceScore ?? 0,
        note: dto.note ?? null,
      },
      update: {
        ...(dto.relevanceScore !== undefined && { relevanceScore: dto.relevanceScore }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
      include: SIN_LINK_INCLUDE,
    });

    return { created: !existing, link: link as SinLinkDto };
  }

  async listSinQuotes(query: SinQuotesAdminQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = this.buildSinQuoteWhere(query);
    const orderBy =
      query.sort === 'score'
        ? [{ relevanceScore: 'desc' as const }, { id: 'asc' as const }]
        : [{ id: 'desc' as const }];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sinQuote.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: SIN_LINK_INCLUDE,
      }),
      this.prisma.sinQuote.count({ where }),
    ]);

    return paginated(rows as SinLinkDto[], page, limit, total);
  }

  async updateSinLink(id: string, dto: UpdateSinLinkDto): Promise<SinLinkDto> {
    const existing = await this.prisma.sinQuote.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Sin-quote link not found' });
    }

    const updated = await this.prisma.sinQuote.update({
      where: { id },
      data: {
        ...(dto.relevanceScore !== undefined && { relevanceScore: dto.relevanceScore }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
      include: SIN_LINK_INCLUDE,
    });

    return updated as SinLinkDto;
  }

  async unlinkSinQuote(id: string): Promise<void> {
    const existing = await this.prisma.sinQuote.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Sin-quote link not found' });
    }
    await this.prisma.sinQuote.delete({ where: { id } });
  }

  async bulkLinkSinQuotes(dto: BulkLinkSinQuotesDto) {
    await this.assertSinExists(dto.sinId);

    let created = 0;
    let updated = 0;
    const skipped = 0;
    const failed: Array<{ quoteId: string; reason: string }> = [];

    for (const item of dto.links) {
      try {
        const quote = await this.prisma.quote.findUnique({ where: { id: item.quoteId } });
        if (!quote) {
          failed.push({ quoteId: item.quoteId, reason: 'RELATED_RESOURCE_INVALID' });
          continue;
        }

        if (quote.type === QuoteType.HADITH && quote.grade != null) {
          try {
            GradePolicy.assertRenderable(quote.grade);
          } catch {
            failed.push({ quoteId: item.quoteId, reason: 'GRADE_NOT_PERMITTED' });
            continue;
          }
        }

        const existing = await this.prisma.sinQuote.findUnique({
          where: { sinId_quoteId: { sinId: dto.sinId, quoteId: item.quoteId } },
        });

        await this.prisma.sinQuote.upsert({
          where: { sinId_quoteId: { sinId: dto.sinId, quoteId: item.quoteId } },
          create: {
            sinId: dto.sinId,
            quoteId: item.quoteId,
            relevanceScore: item.relevanceScore ?? 0,
            note: item.note ?? null,
          },
          update: {
            ...(item.relevanceScore !== undefined && { relevanceScore: item.relevanceScore }),
            ...(item.note !== undefined && { note: item.note }),
          },
        });

        if (existing) {
          updated++;
        } else {
          created++;
        }
      } catch (err) {
        failed.push({
          quoteId: item.quoteId,
          reason: err instanceof Error ? err.message : 'INTERNAL_ERROR',
        });
      }
    }

    return { data: { created, updated, skipped, failed } };
  }

  // ─── GoodDeed-Quote links ────────────────────────────────────────────────────

  async linkGoodDeedQuote(dto: LinkGoodDeedQuoteDto): Promise<{ created: boolean; link: GoodDeedLinkDto }> {
    await this.assertGoodDeedExists(dto.goodDeedId);
    await this.assertQuoteExistsAndGradeAllowed(dto.quoteId);

    const existing = await this.prisma.goodDeedQuote.findUnique({
      where: { goodDeedId_quoteId: { goodDeedId: dto.goodDeedId, quoteId: dto.quoteId } },
    });

    const link = await this.prisma.goodDeedQuote.upsert({
      where: { goodDeedId_quoteId: { goodDeedId: dto.goodDeedId, quoteId: dto.quoteId } },
      create: {
        goodDeedId: dto.goodDeedId,
        quoteId: dto.quoteId,
        relevanceScore: dto.relevanceScore ?? 0,
        note: dto.note ?? null,
      },
      update: {
        ...(dto.relevanceScore !== undefined && { relevanceScore: dto.relevanceScore }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
      include: GOOD_DEED_LINK_INCLUDE,
    });

    return { created: !existing, link: link as GoodDeedLinkDto };
  }

  async listGoodDeedQuotes(query: GoodDeedQuotesAdminQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = this.buildGoodDeedQuoteWhere(query);
    const orderBy =
      query.sort === 'score'
        ? [{ relevanceScore: 'desc' as const }, { id: 'asc' as const }]
        : [{ id: 'desc' as const }];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.goodDeedQuote.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: GOOD_DEED_LINK_INCLUDE,
      }),
      this.prisma.goodDeedQuote.count({ where }),
    ]);

    return paginated(rows as GoodDeedLinkDto[], page, limit, total);
  }

  async updateGoodDeedLink(id: string, dto: UpdateGoodDeedLinkDto): Promise<GoodDeedLinkDto> {
    const existing = await this.prisma.goodDeedQuote.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'GoodDeed-quote link not found' });
    }

    const updated = await this.prisma.goodDeedQuote.update({
      where: { id },
      data: {
        ...(dto.relevanceScore !== undefined && { relevanceScore: dto.relevanceScore }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
      include: GOOD_DEED_LINK_INCLUDE,
    });

    return updated as GoodDeedLinkDto;
  }

  async unlinkGoodDeedQuote(id: string): Promise<void> {
    const existing = await this.prisma.goodDeedQuote.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'GoodDeed-quote link not found' });
    }
    await this.prisma.goodDeedQuote.delete({ where: { id } });
  }

  async bulkLinkGoodDeedQuotes(dto: BulkLinkGoodDeedQuotesDto) {
    await this.assertGoodDeedExists(dto.goodDeedId);

    let created = 0;
    let updated = 0;
    const skipped = 0;
    const failed: Array<{ quoteId: string; reason: string }> = [];

    for (const item of dto.links) {
      try {
        const quote = await this.prisma.quote.findUnique({ where: { id: item.quoteId } });
        if (!quote) {
          failed.push({ quoteId: item.quoteId, reason: 'RELATED_RESOURCE_INVALID' });
          continue;
        }

        if (quote.type === QuoteType.HADITH && quote.grade != null) {
          try {
            GradePolicy.assertRenderable(quote.grade);
          } catch {
            failed.push({ quoteId: item.quoteId, reason: 'GRADE_NOT_PERMITTED' });
            continue;
          }
        }

        const existing = await this.prisma.goodDeedQuote.findUnique({
          where: { goodDeedId_quoteId: { goodDeedId: dto.goodDeedId, quoteId: item.quoteId } },
        });

        await this.prisma.goodDeedQuote.upsert({
          where: { goodDeedId_quoteId: { goodDeedId: dto.goodDeedId, quoteId: item.quoteId } },
          create: {
            goodDeedId: dto.goodDeedId,
            quoteId: item.quoteId,
            relevanceScore: item.relevanceScore ?? 0,
            note: item.note ?? null,
          },
          update: {
            ...(item.relevanceScore !== undefined && { relevanceScore: item.relevanceScore }),
            ...(item.note !== undefined && { note: item.note }),
          },
        });

        if (existing) {
          updated++;
        } else {
          created++;
        }
      } catch (err) {
        failed.push({
          quoteId: item.quoteId,
          reason: err instanceof Error ? err.message : 'INTERNAL_ERROR',
        });
      }
    }

    return { data: { created, updated, skipped, failed } };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async assertSinExists(sinId: string): Promise<void> {
    const sin = await this.prisma.sin.findUnique({ where: { id: sinId } });
    if (!sin) {
      throw new UnprocessableEntityException({
        code: 'RELATED_RESOURCE_INVALID',
        message: 'Sin not found',
      });
    }
  }

  private async assertGoodDeedExists(goodDeedId: string): Promise<void> {
    const deed = await this.prisma.goodDeed.findUnique({ where: { id: goodDeedId } });
    if (!deed) {
      throw new UnprocessableEntityException({
        code: 'RELATED_RESOURCE_INVALID',
        message: 'GoodDeed not found',
      });
    }
  }

  private async assertQuoteExistsAndGradeAllowed(quoteId: string): Promise<void> {
    const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) {
      throw new UnprocessableEntityException({
        code: 'RELATED_RESOURCE_INVALID',
        message: 'Quote not found',
      });
    }
    if (quote.type === QuoteType.HADITH) {
      GradePolicy.assertRenderable(quote.grade);
    }
  }

  private buildSinQuoteWhere(query: SinQuotesAdminQueryDto) {
    const and: Record<string, unknown>[] = [];
    if (query.sinId) and.push({ sinId: query.sinId });
    if (query.quoteId) and.push({ quoteId: query.quoteId });
    if (query.minScore !== undefined) and.push({ relevanceScore: { gte: query.minScore } });
    if (query.maxScore !== undefined) and.push({ relevanceScore: { lte: query.maxScore } });
    if (query.hasNote === true) and.push({ note: { not: null } });
    if (query.hasNote === false) and.push({ note: null });
    return and.length ? { AND: and } : {};
  }

  private buildGoodDeedQuoteWhere(query: GoodDeedQuotesAdminQueryDto) {
    const and: Record<string, unknown>[] = [];
    if (query.goodDeedId) and.push({ goodDeedId: query.goodDeedId });
    if (query.quoteId) and.push({ quoteId: query.quoteId });
    if (query.minScore !== undefined) and.push({ relevanceScore: { gte: query.minScore } });
    if (query.maxScore !== undefined) and.push({ relevanceScore: { lte: query.maxScore } });
    if (query.hasNote === true) and.push({ note: { not: null } });
    if (query.hasNote === false) and.push({ note: null });
    return and.length ? { AND: and } : {};
  }
}
