/**
 * Phase 1 — Shu'ab matn split + rematch helpers.
 * 1) Backfill matnAr / rawPayload.fullTextAr for every book:shuab-iman quote.
 * 2) After takhrij / sunan / hadeethenc, link matched clean quotes onto the
 *    same iman branches (and reviewed branch→topic maps) with basis TAKHRIJ.
 */
import {
  ClassifiedBy,
  LinkBasis,
  LinkReviewStatus,
  MatchDecision,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { splitMatn } from '../../../src/common/text/matn.js';

const SHUAB_PROVIDER = 'book:shuab-iman';
const SAHIHAYN_PROVIDER = 'sahihayn';
const LINK_RELEVANCE = 50;

type Tx = Prisma.TransactionClient | PrismaClient;

function asObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

/** Persist matn for every Shu'ab quote; keep the edition text in rawPayload.fullTextAr. */
export async function backfillShuabMatn(
  prisma: PrismaClient,
): Promise<{ updated: number; already: number; splitFailed: number }> {
  const rows = await prisma.quote.findMany({
    where: { apiProvider: SHUAB_PROVIDER },
    select: { id: true, textAr: true, matnAr: true, rawPayload: true },
    orderBy: { id: 'asc' },
  });
  let updated = 0;
  let already = 0;
  let splitFailed = 0;

  for (const row of rows) {
    const payload = asObject(row.rawPayload);
    const fullText =
      typeof payload.fullTextAr === 'string' && payload.fullTextAr.length > 0
        ? payload.fullTextAr
        : row.textAr;
    const { matnText, isnadText } = splitMatn(fullText);
    const matn = matnText.trim() || fullText;
    if (!isnadText) splitFailed += 1;

    if (row.matnAr === matn && payload.fullTextAr === fullText) {
      already += 1;
      continue;
    }

    await prisma.quote.update({
      where: { id: row.id },
      data: {
        matnAr: matn,
        rawPayload: { ...payload, fullTextAr: fullText },
      },
    });
    updated += 1;
  }

  return { updated, already, splitFailed };
}

/**
 * For Shu'ab quotes with a strong Sahihayn match, link the published Sahihayn
 * quote to the same ACCEPTED branches (basis TAKHRIJ) and to sins/deeds that
 * the reviewer already mapped from those branches.
 */
export async function propagateShuabTakhrijLinks(
  prisma: PrismaClient,
): Promise<{
  branchLinksCreated: number;
  sinLinksCreated: number;
  deedLinksCreated: number;
  skippedNoClean: number;
}> {
  const matches = await prisma.hadithMatch.findMany({
    where: {
      decision: { in: [MatchDecision.CONFIRMED, MatchDecision.CANDIDATE] },
      score: { gte: 0.75 },
      quote: { apiProvider: SHUAB_PROVIDER },
    },
    select: {
      quoteId: true,
      score: true,
      referenceHadith: { select: { book: true, number: true } },
    },
  });

  let branchLinksCreated = 0;
  let sinLinksCreated = 0;
  let deedLinksCreated = 0;
  let skippedNoClean = 0;

  for (const match of matches) {
    // publish.ts stores externalId as `BUKHARI:N` / `MUSLIM:N`
    const externalId = `${match.referenceHadith.book}:${match.referenceHadith.number}`;
    const clean = await prisma.quote.findFirst({
      where: { apiProvider: SAHIHAYN_PROVIDER, externalId },
      select: { id: true },
    });
    if (!clean) {
      skippedNoClean += 1;
      continue;
    }

    const shuabLinks = await prisma.imanBranchQuote.findMany({
      where: { quoteId: match.quoteId, reviewStatus: LinkReviewStatus.ACCEPTED },
      select: { imanBranchId: true, relevanceScore: true, note: true },
    });

    for (const link of shuabLinks) {
      const existing = await prisma.imanBranchQuote.findUnique({
        where: {
          imanBranchId_quoteId: { imanBranchId: link.imanBranchId, quoteId: clean.id },
        },
        select: { id: true, basis: true },
      });
      if (existing) continue;
      await prisma.imanBranchQuote.create({
        data: {
          imanBranchId: link.imanBranchId,
          quoteId: clean.id,
          relevanceScore: link.relevanceScore ?? LINK_RELEVANCE,
          note: link.note
            ? `${link.note} · TAKHRIJ`
            : `تخريج من شعب الإيمان (درجة ${match.score.toFixed(2)})`,
          reviewStatus: LinkReviewStatus.ACCEPTED,
          basis: LinkBasis.TAKHRIJ,
          classifiedBy: ClassifiedBy.BOOK,
        },
      });
      branchLinksCreated += 1;

      const branchSins = await prisma.imanBranchSin.findMany({
        where: { imanBranchId: link.imanBranchId },
        select: { sinId: true },
      });
      for (const { sinId } of branchSins) {
        const had = await prisma.sinQuote.findUnique({
          where: { sinId_quoteId: { sinId, quoteId: clean.id } },
          select: { id: true },
        });
        if (had) continue;
        await prisma.sinQuote.create({
          data: {
            sinId,
            quoteId: clean.id,
            relevanceScore: LINK_RELEVANCE,
            note: `تخريج عبر شعبة الإيمان`,
            reviewStatus: LinkReviewStatus.ACCEPTED,
            basis: LinkBasis.TAKHRIJ,
            classifiedBy: ClassifiedBy.BOOK,
          },
        });
        sinLinksCreated += 1;
      }

      const branchDeeds = await prisma.imanBranchGoodDeed.findMany({
        where: { imanBranchId: link.imanBranchId },
        select: { goodDeedId: true },
      });
      for (const { goodDeedId } of branchDeeds) {
        const had = await prisma.goodDeedQuote.findUnique({
          where: { goodDeedId_quoteId: { goodDeedId, quoteId: clean.id } },
          select: { id: true },
        });
        if (had) continue;
        await prisma.goodDeedQuote.create({
          data: {
            goodDeedId,
            quoteId: clean.id,
            relevanceScore: LINK_RELEVANCE,
            note: `تخريج عبر شعبة الإيمان`,
            reviewStatus: LinkReviewStatus.ACCEPTED,
            basis: LinkBasis.TAKHRIJ,
            classifiedBy: ClassifiedBy.BOOK,
          },
        });
        deedLinksCreated += 1;
      }
    }
  }

  return { branchLinksCreated, sinLinksCreated, deedLinksCreated, skippedNoClean };
}

export async function runShuabRematchPrep(prisma: PrismaClient): Promise<void> {
  const matn = await backfillShuabMatn(prisma);
  console.log(
    `shuab matn backfill: updated=${matn.updated} already=${matn.already} noIsnadCut=${matn.splitFailed}`,
  );
}

export async function runShuabRematchPropagate(prisma: PrismaClient): Promise<void> {
  const links = await propagateShuabTakhrijLinks(prisma);
  console.log(
    `shuab takhrij propagate: branch=${links.branchLinksCreated} sin=${links.sinLinksCreated}` +
      ` deed=${links.deedLinksCreated} skippedNoClean=${links.skippedNoClean}`,
  );
}

/** Prefer stored matnAr for matching; fall back to splitMatn(textAr). */
export function matnForMatching(row: { textAr: string; matnAr?: string | null }): string {
  if (row.matnAr && row.matnAr.trim().length > 0) return row.matnAr.trim();
  return splitMatn(row.textAr).matnText || row.textAr;
}
