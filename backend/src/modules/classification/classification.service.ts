import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LinkReviewStatus, Prisma, QuoteType } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import type { BulkLinkGoodDeedQuotesDto } from './dto/bulk-link-good-deed-quotes.dto.js';
import type { BulkLinkItemDto } from './dto/bulk-link-item.dto.js';
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

/**
 * P2-3: Default admin-list ordering — relevanceScore DESC NULLS LAST, then id ASC.
 * The NULLS LAST is important: newly created links with score=0 (default) must not
 * float to the top and displace curated high-score rows.
 */
const ADMIN_LINK_ORDER_BY_SCORE = [
  { relevanceScore: { sort: 'desc' as const, nulls: 'last' as const } },
  { id: 'asc' as const },
];

/**
 * D-2: `sort=newest` ordering — createdAt DESC, then id ASC for total order.
 * Requires the `createdAt` column added by migration 20261005000002_add_link_timestamps.
 */
const ADMIN_LINK_ORDER_BY_NEWEST = [
  { createdAt: 'desc' as const },
  { id: 'asc' as const },
];


/** Response shape from bulkLink* methods. */
export interface BulkResult {
  data: {
    created: number;
    updated: number;
    skipped: number;
    failed: Array<{ quoteId: string; reason: string }>;
  };
}

// ─── P2-2: Binding object for the shared private generic ─────────────────────
//
// Both the sin-quote and good-deed-quote sides share the same operations
// (link / list / update / unlink). This binding parameterises the generic
// private methods so the logic is written once.
//
// `delegate` is typed loosely because TypeScript cannot express a structural
// union of the two Prisma delegates without resorting to full generic inference;
// the public methods restore the correct types via explicit cast at the boundary.

interface ClassifyBinding {
  /** FK column on the link table referencing the parent entity. */
  parentKey: 'sinId' | 'goodDeedId';
  /** Name of the compound-unique constraint used in `upsert where`. */
  compoundKeyName: string;
  /** Prisma `include` object for detail queries. */
  include: Record<string, unknown>;
  /** Validates the parent record exists; throws 422 if not. */
  assertParent: (id: string) => Promise<void>;
  /** Prisma model delegate (sinQuote or goodDeedQuote). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delegate: Record<string, (...args: any[]) => any>;
  /** Human-readable entity name for 404 messages. */
  notFoundMessage: string;
}

@Injectable()
export class ClassificationService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public API — Sin-Quote links ────────────────────────────────────────────

  async linkSinQuote(dto: LinkSinQuoteDto): Promise<{ created: boolean; link: SinLinkDto }> {
    return this.doLink<SinLinkDto>(this.sinBinding, dto.sinId, dto);
  }

  async listSinQuotes(query: SinQuotesAdminQueryDto) {
    return this.doList<SinLinkDto>(
      this.sinBinding,
      query,
      (q) => this.buildSinQuoteWhere(q),
    );
  }

  async updateSinLink(id: string, dto: UpdateSinLinkDto): Promise<SinLinkDto> {
    return this.doUpdate<SinLinkDto>(this.sinBinding, id, dto);
  }

  async unlinkSinQuote(id: string): Promise<void> {
    return this.doUnlink(this.sinBinding, id);
  }

  async bulkLinkSinQuotes(dto: BulkLinkSinQuotesDto): Promise<BulkResult> {
    await this.assertSinExists(dto.sinId);

    return this.bulkLink({
      links: dto.links,
      fetchExistingPairs: (quoteIds) =>
        this.prisma.sinQuote.findMany({
          where: { sinId: dto.sinId, quoteId: { in: quoteIds } },
          select: { quoteId: true },
        }),
      buildUpserts: (toWrite) =>
        toWrite.map(({ item }) =>
          this.prisma.sinQuote.upsert({
            where: { sinId_quoteId: { sinId: dto.sinId, quoteId: item.quoteId } },
            create: {
              sinId: dto.sinId,
              quoteId: item.quoteId,
              relevanceScore: item.relevanceScore ?? 0,
              note: item.note ?? null,
              reviewStatus: LinkReviewStatus.ACCEPTED,
            },
            update: {
              ...(item.relevanceScore !== undefined && { relevanceScore: item.relevanceScore }),
              ...(item.note !== undefined && { note: item.note }),
              reviewStatus: LinkReviewStatus.ACCEPTED,
            },
          }),
        ),
    });
  }

  // ─── Public API — GoodDeed-Quote links ───────────────────────────────────────

  async linkGoodDeedQuote(dto: LinkGoodDeedQuoteDto): Promise<{ created: boolean; link: GoodDeedLinkDto }> {
    return this.doLink<GoodDeedLinkDto>(this.goodDeedBinding, dto.goodDeedId, dto);
  }

  async listGoodDeedQuotes(query: GoodDeedQuotesAdminQueryDto) {
    return this.doList<GoodDeedLinkDto>(
      this.goodDeedBinding,
      query,
      (q) => this.buildGoodDeedQuoteWhere(q),
    );
  }

  async updateGoodDeedLink(id: string, dto: UpdateGoodDeedLinkDto): Promise<GoodDeedLinkDto> {
    return this.doUpdate<GoodDeedLinkDto>(this.goodDeedBinding, id, dto);
  }

  async unlinkGoodDeedQuote(id: string): Promise<void> {
    return this.doUnlink(this.goodDeedBinding, id);
  }

  async bulkLinkGoodDeedQuotes(dto: BulkLinkGoodDeedQuotesDto): Promise<BulkResult> {
    await this.assertGoodDeedExists(dto.goodDeedId);

    return this.bulkLink({
      links: dto.links,
      fetchExistingPairs: (quoteIds) =>
        this.prisma.goodDeedQuote.findMany({
          where: { goodDeedId: dto.goodDeedId, quoteId: { in: quoteIds } },
          select: { quoteId: true },
        }),
      buildUpserts: (toWrite) =>
        toWrite.map(({ item }) =>
          this.prisma.goodDeedQuote.upsert({
            where: { goodDeedId_quoteId: { goodDeedId: dto.goodDeedId, quoteId: item.quoteId } },
            create: {
              goodDeedId: dto.goodDeedId,
              quoteId: item.quoteId,
              relevanceScore: item.relevanceScore ?? 0,
              note: item.note ?? null,
              reviewStatus: LinkReviewStatus.ACCEPTED,
            },
            update: {
              ...(item.relevanceScore !== undefined && { relevanceScore: item.relevanceScore }),
              ...(item.note !== undefined && { note: item.note }),
              reviewStatus: LinkReviewStatus.ACCEPTED,
            },
          }),
        ),
    });
  }

  // ─── P2-2: Shared private generic operations ─────────────────────────────────
  //
  // One implementation path for link / list / update / unlink.
  // Both sin-quote and good-deed-quote sides are wired in via their binding
  // objects (sinBinding / goodDeedBinding getters below).

  /**
   * Creates or updates a parent↔quote link.
   * The compound-key upsert is idempotent: existing links are updated in-place.
   */
  private async doLink<TLinkDto>(
    binding: ClassifyBinding,
    parentId: string,
    dto: {
      quoteId: string;
      relevanceScore?: number;
      note?: string | null;
      reviewStatus?: LinkReviewStatus;
    },
  ): Promise<{ created: boolean; link: TLinkDto }> {
    await binding.assertParent(parentId);
    await this.assertQuoteExistsAndGradeAllowed(dto.quoteId);

    const compoundWhere = {
      [binding.compoundKeyName]: { [binding.parentKey]: parentId, quoteId: dto.quoteId },
    };

    const existing: unknown = await binding.delegate['findUnique']({ where: compoundWhere });

    const link = (await binding.delegate['upsert']({
      where: compoundWhere,
      create: {
        [binding.parentKey]: parentId,
        quoteId: dto.quoteId,
        relevanceScore: dto.relevanceScore ?? 0,
        note: dto.note ?? null,
        reviewStatus: dto.reviewStatus ?? LinkReviewStatus.ACCEPTED,
      },
      update: {
        ...(dto.relevanceScore !== undefined && { relevanceScore: dto.relevanceScore }),
        ...(dto.note !== undefined && { note: dto.note }),
        reviewStatus: dto.reviewStatus ?? LinkReviewStatus.ACCEPTED,
      },
      include: binding.include,
    })) as TLinkDto;

    return { created: !existing, link };
  }

  /**
   * Returns a paginated list of links matching the query.
   *
   * P2-3: always appends `id ASC` as the final tiebreaker for stable pagination.
   * D-2: `sort=newest` orders by `createdAt DESC, id ASC` (requires the column
   *      added by migration 20261005000002_add_link_timestamps).
   *      Default `sort=score` orders by `relevanceScore DESC NULLS LAST, id ASC`.
   */
  private async doList<TLinkDto>(
    binding: ClassifyBinding,
    query: { page?: number; limit?: number; sort?: 'score' | 'newest' },
    buildWhere: (q: typeof query) => Record<string, unknown>,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = buildWhere(query);

    const orderBy =
      query.sort === 'newest' ? ADMIN_LINK_ORDER_BY_NEWEST : ADMIN_LINK_ORDER_BY_SCORE;

    // Cast needed: delegate methods return `any`; we embed them in a typed $transaction
    // tuple so the return value is properly typed as [TLinkDto[], number].
    const findManyOp = binding.delegate['findMany']({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: binding.include,
    }) as Prisma.PrismaPromise<TLinkDto[]>;
    const countOp = binding.delegate['count']({ where }) as Prisma.PrismaPromise<number>;

    const [rows, total] = await this.prisma.$transaction([findManyOp, countOp]);

    return paginated(rows as TLinkDto[], page, limit, total);
  }

  /**
   * Patches an existing link's `relevanceScore` and/or `note`.
   * Throws 404 if the link id is not found.
   */
  private async doUpdate<TLinkDto>(
    binding: ClassifyBinding,
    id: string,
    dto: { relevanceScore?: number; note?: string | null; reviewStatus?: LinkReviewStatus },
  ): Promise<TLinkDto> {
    const existing: unknown = await binding.delegate['findUnique']({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: binding.notFoundMessage });
    }

    return (await binding.delegate['update']({
      where: { id },
      data: {
        ...(dto.relevanceScore !== undefined && { relevanceScore: dto.relevanceScore }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.reviewStatus !== undefined && { reviewStatus: dto.reviewStatus }),
      },
      include: binding.include,
    })) as TLinkDto;
  }

  /**
   * Deletes an existing link.
   * Throws 404 if the link id is not found.
   */
  private async doUnlink(binding: ClassifyBinding, id: string): Promise<void> {
    const existing: unknown = await binding.delegate['findUnique']({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: binding.notFoundMessage });
    }
    await binding.delegate['delete']({ where: { id } });
  }

  // ─── Binding objects (constructed per-call — no state) ────────────────────────

  private get sinBinding(): ClassifyBinding {
    return {
      parentKey: 'sinId',
      compoundKeyName: 'sinId_quoteId',
      include: SIN_LINK_INCLUDE as Record<string, unknown>,
      assertParent: (id) => this.assertSinExists(id),
      delegate: this.prisma.sinQuote as unknown as Record<string, (...args: unknown[]) => unknown>,
      notFoundMessage: 'Sin-quote link not found',
    };
  }

  private get goodDeedBinding(): ClassifyBinding {
    return {
      parentKey: 'goodDeedId',
      compoundKeyName: 'goodDeedId_quoteId',
      include: GOOD_DEED_LINK_INCLUDE as Record<string, unknown>,
      assertParent: (id) => this.assertGoodDeedExists(id),
      delegate: this.prisma.goodDeedQuote as unknown as Record<string, (...args: unknown[]) => unknown>,
      notFoundMessage: 'GoodDeed-quote link not found',
    };
  }

  // ─── Shared transactional bulk-link implementation (P1-7 / P2-2) ─────────────
  //
  // Pre-validates all quotes in two batch queries, classifies each item as
  // failed / skipped / to-write, then runs every upsert in ONE $transaction so a
  // mid-batch crash leaves nothing half-written.
  //
  // Stable codes only (never raw Prisma messages) are used for failed items:
  //   RELATED_RESOURCE_INVALID — quoteId not found
  //   GRADE_NOT_PERMITTED      — MAWDU hadith
  //
  // Duplicate quoteId within a single payload: the first occurrence is kept;
  // subsequent occurrences increment `skipped` (documented in the API contract).
  private async bulkLink(opts: {
    links: BulkLinkItemDto[];
    fetchExistingPairs: (quoteIds: string[]) => Promise<Array<{ quoteId: string }>>;
    buildUpserts: (
      toWrite: Array<{ item: BulkLinkItemDto; isUpdate: boolean }>,
    ) => Prisma.PrismaPromise<unknown>[];
  }): Promise<BulkResult> {
    const { links, fetchExistingPairs, buildUpserts } = opts;
    const failed: Array<{ quoteId: string; reason: string }> = [];
    let skipped = 0;

    // 1. De-duplicate quoteIds — keep first occurrence, mark duplicates as skipped
    const seen = new Set<string>();
    const deduplicated: BulkLinkItemDto[] = [];
    for (const item of links) {
      if (seen.has(item.quoteId)) {
        skipped++;
      } else {
        seen.add(item.quoteId);
        deduplicated.push(item);
      }
    }

    if (deduplicated.length === 0) {
      return { data: { created: 0, updated: 0, skipped, failed } };
    }

    const quoteIds = deduplicated.map((i) => i.quoteId);

    // 2. Batch-fetch all referenced quotes (one round trip)
    const foundQuotes = await this.prisma.quote.findMany({
      where: { id: { in: quoteIds } },
      select: { id: true, type: true, grade: true },
    });
    const quoteMap = new Map(foundQuotes.map((q) => [q.id, q]));

    // 3. Batch-fetch existing pairs (one round trip)
    const existingPairs = await fetchExistingPairs(quoteIds);
    const existingSet = new Set(existingPairs.map((p) => p.quoteId));

    // 4. Classify each item
    const toWrite: Array<{ item: BulkLinkItemDto; isUpdate: boolean }> = [];
    for (const item of deduplicated) {
      const quote = quoteMap.get(item.quoteId);
      if (!quote) {
        failed.push({ quoteId: item.quoteId, reason: 'RELATED_RESOURCE_INVALID' });
        continue;
      }
      if (quote.type === QuoteType.HADITH) {
        try {
          GradePolicy.assertRenderable(quote.grade);
        } catch {
          failed.push({ quoteId: item.quoteId, reason: 'GRADE_NOT_PERMITTED' });
          continue;
        }
      }
      toWrite.push({ item, isUpdate: existingSet.has(item.quoteId) });
    }

    // 5. Run all upserts in ONE transaction — nothing is partially written on throw
    if (toWrite.length > 0) {
      const ops = buildUpserts(toWrite);
      // Cast needed: $transaction's tuple overload cannot infer a dynamic array's
      // element types at compile time; at runtime every element IS a PrismaPromise.
      await (this.prisma.$transaction as (ops: Prisma.PrismaPromise<unknown>[]) => Promise<unknown[]>)(ops);
    }

    const created = toWrite.filter((w) => !w.isUpdate).length;
    const updated = toWrite.filter((w) => w.isUpdate).length;

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
    if (query.reviewStatus) and.push({ reviewStatus: query.reviewStatus });
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
    if (query.reviewStatus) and.push({ reviewStatus: query.reviewStatus });
    return and.length ? { AND: and } : {};
  }
}
