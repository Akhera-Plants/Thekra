import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EntityOrigin,
  LinkReviewStatus,
  Prisma,
  QuoteType,
  SinRank,
  type PrismaClient,
} from '@prisma/client';
import { STRONG_MATCH_SCORE } from '../../../src/common/text/match-score.js';
import { GradePolicy } from '../../../src/modules/hadith/grade-policy.js';
import type { ImportOptions } from '../lib/cli.js';
import { inTransactionBatches } from '../lib/batch.js';
import { ITEM_DECISIONS } from './decisions.js';
import { buildLinks, loadContentMap, type DesiredLink, type LinkBuild, type ReadySection } from './links.js';
import {
  coverage,
  coverageDiff,
  matchKeywords,
  matchSection,
  withKabiraNumbers,
  type BookKey,
  type MatchSection,
} from './match.js';
import { loadSahihaynMap } from './sahihayn-map.js';
import { loadTaxonomy, topicBySlug, type TaxonomyFile, type Topic } from './yaml.js';

const KABAIR_SOURCE_ID = '10000000-0000-4000-8000-000000000007';
const BUKHARI_SOURCE_ID = '10000000-0000-4000-8000-000000000002';
const MUSLIM_SOURCE_ID = '10000000-0000-4000-8000-000000000003';

const SOURCE_ID: Record<Exclude<BookKey, 'shuab'>, string> = {
  bukhari: BUKHARI_SOURCE_ID,
  muslim: MUSLIM_SOURCE_ID,
  adab: '10000000-0000-4000-8000-000000000006',
  kabair: KABAIR_SOURCE_ID,
  targhib: '10000000-0000-4000-8000-000000000008',
  riyad: '10000000-0000-4000-8000-000000000009',
  zuhd: '10000000-0000-4000-8000-000000000011',
  minhaj: '10000000-0000-4000-8000-000000000012',
  munajjid: '10000000-0000-4000-8000-000000000015',
};

interface Tally {
  created: number;
  updated: number;
  deleted: number;
}

interface QuoteMeta {
  type: QuoteType;
  gradeSource: Parameters<typeof GradePolicy.isPublishable>[0]['gradeSource'];
  textSource: Parameters<typeof GradePolicy.isPublicText>[0]['textSource'];
  textVerifiedAt: Date | null;
  apiProvider: string | null;
  highFlag: boolean;
  textAr: string;
}

const ZERO: Tally = { created: 0, updated: 0, deleted: 0 };

function plus(left: Tally, right: Tally): Tally {
  return {
    created: left.created + right.created,
    updated: left.updated + right.updated,
    deleted: left.deleted + right.deleted,
  };
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function hadithScore(quote: QuoteMeta | undefined): number {
  if (!quote) return 50;
  const excerpt = quote.apiProvider === 'book-structure' && quote.type === QuoteType.BOOK_EXCERPT;
  const publishable = GradePolicy.isPublishable(quote) && GradePolicy.isPublicText(quote) && !excerpt && !quote.highFlag;
  return publishable ? 80 : 50;
}

function isOldNote(note: string | null, score: number | null): boolean {
  if (!note) return false;
  if (note.startsWith('باب ')) return true;
  return note.includes('تفسير السعدي') && (score === null || score === 0);
}

function parentTitles(sectionId: string, parentOf: Map<string, { parentId: string | null; titleAr: string }>): string {
  const titles: string[] = [];
  const seen = new Set<string>();
  let parentId = parentOf.get(sectionId)?.parentId ?? null;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = parentOf.get(parentId);
    if (!parent) break;
    titles.push(parent.titleAr);
    parentId = parent.parentId;
  }
  return titles.join(' › ');
}

function rankFor(topic: Topic, titles: ReadonlyMap<number, string>): { rank: SinRank | null; rankSourceId: string | null; rankReference: string | null } {
  if (topic.kabair.length === 0) return { rank: null, rankSourceId: null, rankReference: null };
  if (topic.side !== 'AVOID') throw new Error(`${topic.slug} is a good deed with a kabair number`);
  const number = topic.kabair[0] ?? 0;
  const title = titles.get(number);
  const rankReference = title ? `الكبائر للذهبي، الكبيرة رقم ${number} — ${title}` : `الكبائر للذهبي، الكبيرة رقم ${number}`;
  return { rank: SinRank.KABIRA, rankSourceId: KABAIR_SOURCE_ID, rankReference };
}

function sameLink(row: { basis: string; classifiedBy: string; reviewStatus: string; note: string | null; relevanceScore: number | null; sectionId: string | null }, link: DesiredLink): boolean {
  return row.basis === link.basis
    && row.classifiedBy === link.classifiedBy
    && row.reviewStatus === link.reviewStatus
    && (row.note ?? '') === link.note
    && (row.relevanceScore ?? 0) === link.relevanceScore
    && (row.sectionId ?? null) === link.sectionId;
}

async function loadSections(prisma: PrismaClient, quotes: Map<string, QuoteMeta>): Promise<ReadySection[]> {
  const loaded: MatchSection[] = [];
  const itemsOf = new Map<string, ReadySection['items']>();
  const pageOf = new Map<string, string | null>();
  for (const [book, sourceId] of Object.entries(SOURCE_ID) as [BookKey, string][]) {
    const rows = await prisma.bookSection.findMany({
      where: { sourceId },
      select: {
        id: true,
        parentId: true,
        level: true,
        number: true,
        titleAr: true,
        order: true,
        page: true,
        items: { orderBy: { order: 'asc' }, select: { order: true, kind: true, quoteId: true } },
      },
    });
    const parents = new Map(rows.map((row) => [row.id, { parentId: row.parentId, titleAr: row.titleAr }]));
    let ayah = 0;
    let hadith = 0;
    let author = 0;
    for (const row of rows) {
      ayah = 0;
      hadith = 0;
      author = 0;
      const items: ReadySection['items'] = [];
      for (const item of row.items) {
        if (item.kind === 'AYAH') ayah += 1;
        else if (item.kind === 'HADITH') hadith += 1;
        else author += 1;
        const meta = item.quoteId ? quotes.get(item.quoteId) : undefined;
        items.push({
          order: item.order,
          kind: item.kind,
          quoteId: item.quoteId,
          score: item.kind === 'AYAH' ? 90 : hadithScore(meta),
        });
      }
      itemsOf.set(row.id, items);
      pageOf.set(row.id, row.page);
      loaded.push({
        id: row.id,
        book,
        level: row.level,
        number: row.number,
        titleAr: row.titleAr,
        parentPath: parentTitles(row.id, parents),
        ayah,
        hadith,
        author,
        kabiraNumber: null,
        order: row.order,
      });
    }
    console.log(`taxonomy: loaded ${book} (${rows.length} sections)`);
  }
  const quoteIds = [...itemsOf.values()].flatMap((items) => items.flatMap((item) => item.quoteId ? [item.quoteId] : []));
  await loadQuotes(prisma, quoteIds, quotes);
  const stamped = withKabiraNumbers(loaded);
  const topics = topicBySlug(loadTaxonomy(yamlPath()).topics);
  return stamped.map((section) => ({
    ...section,
    page: pageOf.get(section.id) ?? null,
    items: (itemsOf.get(section.id) ?? []).map((item) => ({
      ...item,
      score: item.kind === 'AYAH' ? 90 : hadithScore(item.quoteId ? quotes.get(item.quoteId) : undefined),
    })),
    anchorSlugs: matchSection(section, [...topics.values()]),
    keywordSlugs: matchKeywords(section, [...topics.values()]),
  }));
}

function yamlPath(): string {
  return join(import.meta.dirname, '..', '..', 'taxonomy', 'taxonomy.yaml');
}

function docsPath(): string {
  return join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'taxonomy');
}

async function loadQuotes(prisma: PrismaClient, ids: readonly string[], into: Map<string, QuoteMeta>): Promise<void> {
  const missing = ids.filter((id) => !into.has(id));
  for (const batch of chunks([...new Set(missing)], 4000)) {
    const rows = await prisma.quote.findMany({
      where: { id: { in: batch } },
      select: { id: true, type: true, gradeSource: true, textSource: true, textVerifiedAt: true, apiProvider: true, textAr: true },
    });
    const flagged = new Set((await prisma.quoteFlag.findMany({
      where: { quoteId: { in: batch }, status: 'OPEN', severity: 'HIGH' },
      select: { quoteId: true },
    })).map((flag) => flag.quoteId));
    for (const row of rows) {
      into.set(row.id, { ...row, highFlag: flagged.has(row.id) });
    }
  }
}

async function strongMatches(prisma: PrismaClient, quoteIds: readonly string[]): Promise<Map<string, { book: 'BUKHARI' | 'MUSLIM'; number: number }[]>> {
  const best = new Map<string, { book: 'BUKHARI' | 'MUSLIM'; number: number; score: number }>();
  for (const batch of chunks([...new Set(quoteIds)], 4000)) {
    const rows = await prisma.hadithMatch.findMany({
      where: { quoteId: { in: batch }, score: { gte: STRONG_MATCH_SCORE } },
      select: { quoteId: true, score: true, referenceHadith: { select: { book: true, number: true } } },
    });
    for (const row of rows) {
      const key = `${row.quoteId}:${row.referenceHadith.book}`;
      const current = best.get(key);
      if (!current || row.score > current.score) {
        best.set(key, { book: row.referenceHadith.book, number: row.referenceHadith.number, score: row.score });
      }
    }
  }
  const grouped = new Map<string, { book: 'BUKHARI' | 'MUSLIM'; number: number }[]>();
  for (const [key, hit] of best) {
    const quoteId = key.slice(0, key.lastIndexOf(':'));
    const list = grouped.get(quoteId) ?? [];
    list.push({ book: hit.book, number: hit.number });
    grouped.set(quoteId, list);
  }
  return grouped;
}

async function sahihaynQuotes(prisma: PrismaClient, hits: Map<string, { book: 'BUKHARI' | 'MUSLIM'; number: number }[]>): Promise<Map<string, string>> {
  const numbers = [...new Set([...hits.values()].flatMap((list) => list.map((hit) => hit.number)))];
  const picked = new Map<string, { id: string; textSource: string }>();
  for (const batch of chunks(numbers, 4000)) {
    const rows = await prisma.quote.findMany({
      where: { sourceId: { in: [BUKHARI_SOURCE_ID, MUSLIM_SOURCE_ID] }, referenceNumber: { in: batch } },
      select: { id: true, sourceId: true, referenceNumber: true, textSource: true },
    });
    for (const row of rows) {
      if (row.referenceNumber === null) continue;
      const book = row.sourceId === BUKHARI_SOURCE_ID ? 'BUKHARI' : 'MUSLIM';
      const key = `${book}:${row.referenceNumber}`;
      const current = picked.get(key);
      const digital = row.textSource === 'DIGITAL';
      if (!current || (digital && current.textSource !== 'DIGITAL') || (digital === (current.textSource === 'DIGITAL') && row.id < current.id)) {
        picked.set(key, { id: row.id, textSource: row.textSource });
      }
    }
  }
  return new Map([...picked].map(([key, row]) => [key, row.id]));
}

interface TopicIds {
  sins: Map<string, string>;
  deeds: Map<string, string>;
}

function idOf(ids: TopicIds, topic: Topic): string {
  const id = (topic.side === 'AVOID' ? ids.sins : ids.deeds).get(topic.slug);
  if (!id) throw new Error(`Topic ${topic.slug} has no row`);
  return id;
}

async function syncTopics(
  prisma: PrismaClient,
  file: TaxonomyFile,
  titles: ReadonlyMap<number, string>,
  write: boolean,
): Promise<{ tally: Tally; ids: TopicIds }> {
  let tally = { ...ZERO };
  const sins = await prisma.sin.findMany({
    select: {
      id: true, slug: true, name: true, nameAr: true, domainKey: true, origin: true,
      isContemporary: true, isHidden: true, isListed: true, taxonomyOrder: true,
      oppositeGoodDeedId: true, rank: true, rankSourceId: true, rankReference: true,
    },
  });
  const deeds = await prisma.goodDeed.findMany({
    select: {
      id: true, slug: true, name: true, nameAr: true, domainKey: true, origin: true,
      isContemporary: true, isHidden: true, isListed: true, taxonomyOrder: true, oppositeSinId: true,
    },
  });
  const sinBySlug = new Map(sins.map((row) => [row.slug, row]));
  const deedBySlug = new Map(deeds.map((row) => [row.slug, row]));
  const claimed = new Set(file.topics.flatMap((topic) => topic.kabair));
  const ids: TopicIds = { sins: new Map(), deeds: new Map() };

  for (const domain of file.domains) {
    const existing = await prisma.topicDomain.findUnique({ where: { key: domain.key } });
    const data = { nameAr: domain.nameAr, nameEn: domain.nameAr, order: domain.order };
    if (!existing) {
      tally.created += 1;
      if (write) await prisma.topicDomain.create({ data: { key: domain.key, ...data } });
    } else if (existing.nameAr !== data.nameAr || existing.nameEn !== data.nameEn || existing.order !== data.order) {
      tally.updated += 1;
      if (write) await prisma.topicDomain.update({ where: { key: domain.key }, data });
    }
  }

  for (const topic of file.topics) {
    const rank = rankFor(topic, titles);
    const shared = {
      name: topic.en,
      nameAr: topic.ar,
      domainKey: topic.domain,
      origin: EntityOrigin.TAXONOMY,
      isContemporary: topic.contemporary,
      isHidden: topic.hidden,
      isListed: topic.listed,
      taxonomyOrder: topic.order,
    };
    if (topic.side === 'AVOID') {
      const existing = sinBySlug.get(topic.slug);
      if (!existing) {
        tally.created += 1;
        if (write) {
          const created = await prisma.sin.create({ data: { slug: topic.slug, ...shared, ...rank } });
          ids.sins.set(topic.slug, created.id);
        }
      } else {
        ids.sins.set(topic.slug, existing.id);
        const changed = existing.name !== shared.name || existing.nameAr !== shared.nameAr || existing.domainKey !== shared.domainKey
          || existing.origin !== shared.origin || existing.isContemporary !== shared.isContemporary || existing.isHidden !== shared.isHidden
          || existing.isListed !== shared.isListed || existing.taxonomyOrder !== shared.taxonomyOrder
          || existing.rank !== rank.rank || existing.rankSourceId !== rank.rankSourceId || existing.rankReference !== rank.rankReference;
        if (changed) {
          tally.updated += 1;
          if (write) await prisma.sin.update({ where: { id: existing.id }, data: { ...shared, ...rank } });
        }
      }
    } else {
      const existing = deedBySlug.get(topic.slug);
      if (!existing) {
        tally.created += 1;
        if (write) {
          const created = await prisma.goodDeed.create({ data: { slug: topic.slug, ...shared } });
          ids.deeds.set(topic.slug, created.id);
        }
      } else {
        ids.deeds.set(topic.slug, existing.id);
        const changed = existing.name !== shared.name || existing.nameAr !== shared.nameAr || existing.domainKey !== shared.domainKey
          || existing.origin !== shared.origin || existing.isContemporary !== shared.isContemporary || existing.isHidden !== shared.isHidden
          || existing.isListed !== shared.isListed || existing.taxonomyOrder !== shared.taxonomyOrder;
        if (changed) {
          tally.updated += 1;
          if (write) await prisma.goodDeed.update({ where: { id: existing.id }, data: shared });
        }
      }
    }
  }

  if (write) {
    for (const topic of file.topics) {
      const oppositeId = topic.opposite ? idOf(ids, topicBySlug(file.topics).get(topic.opposite) as Topic) : null;
      if (topic.side === 'AVOID') {
        const id = ids.sins.get(topic.slug) as string;
        const current = sinBySlug.get(topic.slug)?.oppositeGoodDeedId ?? null;
        if (current !== oppositeId) {
          tally.updated += 1;
          await prisma.sin.update({ where: { id }, data: { oppositeGoodDeedId: oppositeId } });
        }
      } else {
        const id = ids.deeds.get(topic.slug) as string;
        const current = deedBySlug.get(topic.slug)?.oppositeSinId ?? null;
        if (current !== oppositeId) {
          tally.updated += 1;
          await prisma.goodDeed.update({ where: { id }, data: { oppositeSinId: oppositeId } });
        }
      }
    }
  } else {
    for (const topic of file.topics) {
      if (!topic.opposite) continue;
      if (topic.side === 'AVOID') {
        const current = sinBySlug.get(topic.slug)?.oppositeGoodDeedId ?? null;
        const opposite = deedBySlug.get(topic.opposite)?.id ?? null;
        if (sinBySlug.has(topic.slug) && current !== opposite) tally.updated += 1;
        if (!sinBySlug.has(topic.slug)) tally.updated += 1;
      } else {
        const current = deedBySlug.get(topic.slug)?.oppositeSinId ?? null;
        const opposite = sinBySlug.get(topic.opposite)?.id ?? null;
        if (deedBySlug.has(topic.slug) && current !== opposite) tally.updated += 1;
        if (!deedBySlug.has(topic.slug)) tally.updated += 1;
      }
    }
  }

  const yamlSlugs = new Set(file.topics.map((topic) => topic.slug));
  for (const sin of sins) {
    const number = sin.slug.startsWith('kabira-') ? Number(sin.slug.slice('kabira-'.length)) : null;
    const leftover = number !== null && !claimed.has(number);
    if (leftover) {
      if (!sin.isHidden || sin.origin !== EntityOrigin.TAXONOMY) {
        tally.updated += 1;
        if (write) await prisma.sin.update({ where: { id: sin.id }, data: { isHidden: true, origin: EntityOrigin.TAXONOMY } });
      }
      continue;
    }
    if (yamlSlugs.has(sin.slug)) continue;
    if (number !== null && claimed.has(number)) {
      const targetSlug = file.topics.find((topic) => topic.kabair.includes(number))?.slug;
      const targetId = targetSlug ? ids.sins.get(targetSlug) : undefined;
      if (write && targetId) {
        const links = await prisma.sinQuote.findMany({ where: { sinId: sin.id }, select: { id: true, quoteId: true } });
        const taken = new Set((await prisma.sinQuote.findMany({ where: { sinId: targetId }, select: { quoteId: true } })).map((link) => link.quoteId));
        for (const link of links) {
          if (taken.has(link.quoteId)) {
            tally.deleted += 1;
            await prisma.sinQuote.delete({ where: { id: link.id } });
          } else {
            tally.updated += 1;
            await prisma.sinQuote.update({ where: { id: link.id }, data: { sinId: targetId } });
          }
        }
      }
      tally.deleted += 1;
      if (write) await prisma.sin.delete({ where: { id: sin.id } });
      continue;
    }
    if (sin.origin === EntityOrigin.AUTO_CHAPTER) {
      if (write) {
        const removed = await prisma.sinQuote.deleteMany({ where: { sinId: sin.id } });
        tally.deleted += removed.count;
        await prisma.sin.delete({ where: { id: sin.id } });
      }
      tally.deleted += 1;
    }
  }
  for (const deed of deeds) {
    if (yamlSlugs.has(deed.slug) || deed.origin !== EntityOrigin.AUTO_CHAPTER) continue;
    if (write) {
      const removed = await prisma.goodDeedQuote.deleteMany({ where: { goodDeedId: deed.id } });
      tally.deleted += removed.count;
      await prisma.goodDeed.delete({ where: { id: deed.id } });
    }
    tally.deleted += 1;
  }

  tally = plus(tally, await syncDerivations(prisma, file, ids, write));
  tally = plus(tally, await syncLabels(prisma, file, write));
  tally = plus(tally, await syncBranches(prisma, file, ids, write));
  return { tally, ids };
}

async function syncDerivations(prisma: PrismaClient, file: TaxonomyFile, ids: TopicIds, write: boolean): Promise<Tally> {
  const tally = { ...ZERO };
  const topics = topicBySlug(file.topics);
  const desired: Prisma.TopicDerivationCreateManyInput[] = [];
  for (const topic of file.topics) {
    for (const slug of topic.derivedFrom) {
      const target = topics.get(slug);
      if (!target) continue;
      desired.push({
        fromSinId: topic.side === 'AVOID' ? ids.sins.get(topic.slug) ?? null : null,
        fromGoodDeedId: topic.side === 'DO' ? ids.deeds.get(topic.slug) ?? null : null,
        toSinId: target.side === 'AVOID' ? ids.sins.get(target.slug) ?? null : null,
        toGoodDeedId: target.side === 'DO' ? ids.deeds.get(target.slug) ?? null : null,
      });
    }
  }
  const existing = await prisma.topicDerivation.findMany();
  const key = (row: { fromSinId?: string | null; fromGoodDeedId?: string | null; toSinId?: string | null; toGoodDeedId?: string | null }) =>
    `${row.fromSinId ?? ''}|${row.fromGoodDeedId ?? ''}|${row.toSinId ?? ''}|${row.toGoodDeedId ?? ''}`;
  const have = new Map(existing.map((row) => [key(row), row.id]));
  const want = new Set(desired.map((row) => key(row)));
  const creating = desired.filter((row) => !have.has(key(row)));
  const removing = existing.filter((row) => !want.has(key(row))).map((row) => row.id);
  tally.created = creating.length;
  tally.deleted = removing.length;
  if (!write) return tally;
  if (creating.length > 0) await prisma.topicDerivation.createMany({ data: creating });
  if (removing.length > 0) await prisma.topicDerivation.deleteMany({ where: { id: { in: removing } } });
  tally.created = creating.length;
  tally.deleted = removing.length;
  return tally;
}

async function syncLabels(prisma: PrismaClient, file: TaxonomyFile, write: boolean): Promise<Tally> {
  const tally = { ...ZERO };
  const topics = topicBySlug(file.topics);
  const desired = file.akhlaq.flatMap((label) => label.topics.map((slug) => {
    const topic = topics.get(slug);
    if (!topic) throw new Error(`Akhlaq ${label.key} names unknown ${slug}`);
    return { labelKey: label.key, labelAr: label.ar, side: topic.side, slug };
  }));
  const existing = await prisma.topicLabel.findMany();
  const key = (row: { labelKey: string; side: string; slug: string }) => `${row.labelKey}|${row.side}|${row.slug}`;
  const have = new Map(existing.map((row) => [key(row), row]));
  const want = new Set(desired.map((row) => key(row)));
  for (const row of desired) {
    const current = have.get(key(row));
    if (!current) tally.created += 1;
    else if (current.labelAr !== row.labelAr) tally.updated += 1;
  }
  tally.deleted = existing.filter((row) => !want.has(key(row))).length;
  if (!write) return tally;
  const creating = desired.filter((row) => !have.has(key(row)));
  if (creating.length > 0) await prisma.topicLabel.createMany({ data: creating });
  for (const row of desired) {
    const current = have.get(key(row));
    if (current && current.labelAr !== row.labelAr) await prisma.topicLabel.update({ where: { id: current.id }, data: { labelAr: row.labelAr } });
  }
  const removing = existing.filter((row) => !want.has(key(row))).map((row) => row.id);
  if (removing.length > 0) await prisma.topicLabel.deleteMany({ where: { id: { in: removing } } });
  return tally;
}

async function syncBranches(prisma: PrismaClient, file: TaxonomyFile, ids: TopicIds, write: boolean): Promise<Tally> {
  const tally = { ...ZERO };
  const branches = new Map((await prisma.imanBranch.findMany({ select: { id: true, number: true } })).map((row) => [row.number, row.id]));
  for (const topic of file.topics) {
    for (const number of topic.branches) {
      if (!branches.has(number)) throw new Error(`Iman branch ${number} (${topic.slug}) is not in the database`);
    }
  }
  const sinLinks = await prisma.imanBranchSin.findMany({ select: { id: true, imanBranchId: true, sinId: true, sortOrder: true } });
  const deedLinks = await prisma.imanBranchGoodDeed.findMany({ select: { id: true, imanBranchId: true, goodDeedId: true, sortOrder: true } });
  const wantSin = new Map<string, number>();
  const wantDeed = new Map<string, number>();
  for (const topic of file.topics) {
    topic.branches.forEach((number, index) => {
      const branchId = branches.get(number) as string;
      const topicId = topic.side === 'AVOID' ? ids.sins.get(topic.slug) : ids.deeds.get(topic.slug);
      if (!topicId) return;
      (topic.side === 'AVOID' ? wantSin : wantDeed).set(`${branchId}|${topicId}`, index);
    });
  }
  const taxonomySins = new Set(ids.sins.values());
  const taxonomyDeeds = new Set(ids.deeds.values());
  const sinCreates: Prisma.ImanBranchSinCreateManyInput[] = [];
  const deedCreates: Prisma.ImanBranchGoodDeedCreateManyInput[] = [];
  const sinUpdates: { id: string; sortOrder: number }[] = [];
  const deedUpdates: { id: string; sortOrder: number }[] = [];
  const sinDeletes: string[] = [];
  const deedDeletes: string[] = [];
  const seenSin = new Set<string>();
  for (const link of sinLinks) {
    if (!taxonomySins.has(link.sinId)) continue;
    const key = `${link.imanBranchId}|${link.sinId}`;
    const sortOrder = wantSin.get(key);
    if (sortOrder === undefined) sinDeletes.push(link.id);
    else {
      seenSin.add(key);
      if (link.sortOrder !== sortOrder) sinUpdates.push({ id: link.id, sortOrder });
    }
  }
  const seenDeed = new Set<string>();
  for (const link of deedLinks) {
    if (!taxonomyDeeds.has(link.goodDeedId)) continue;
    const key = `${link.imanBranchId}|${link.goodDeedId}`;
    const sortOrder = wantDeed.get(key);
    if (sortOrder === undefined) deedDeletes.push(link.id);
    else {
      seenDeed.add(key);
      if (link.sortOrder !== sortOrder) deedUpdates.push({ id: link.id, sortOrder });
    }
  }
  for (const [key, sortOrder] of wantSin) {
    if (seenSin.has(key)) continue;
    const [imanBranchId, sinId] = key.split('|');
    sinCreates.push({ imanBranchId: imanBranchId ?? '', sinId: sinId ?? '', sortOrder });
  }
  for (const [key, sortOrder] of wantDeed) {
    if (seenDeed.has(key)) continue;
    const [imanBranchId, goodDeedId] = key.split('|');
    deedCreates.push({ imanBranchId: imanBranchId ?? '', goodDeedId: goodDeedId ?? '', sortOrder });
  }
  tally.created = sinCreates.length + deedCreates.length;
  tally.updated = sinUpdates.length + deedUpdates.length;
  tally.deleted = sinDeletes.length + deedDeletes.length;
  if (!write) return tally;
  if (sinCreates.length > 0) await prisma.imanBranchSin.createMany({ data: sinCreates });
  if (deedCreates.length > 0) await prisma.imanBranchGoodDeed.createMany({ data: deedCreates });
  for (const row of sinUpdates) await prisma.imanBranchSin.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } });
  for (const row of deedUpdates) await prisma.imanBranchGoodDeed.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } });
  if (sinDeletes.length > 0) await prisma.imanBranchSin.deleteMany({ where: { id: { in: sinDeletes } } });
  if (deedDeletes.length > 0) await prisma.imanBranchGoodDeed.deleteMany({ where: { id: { in: deedDeletes } } });
  return tally;
}

interface StoredLink {
  id: string;
  ownerId: string;
  quoteId: string;
  basis: string;
  classifiedBy: string;
  reviewStatus: string;
  note: string | null;
  relevanceScore: number | null;
  sectionId: string | null;
  side: 'AVOID' | 'DO';
}

async function syncLinks(prisma: PrismaClient, built: LinkBuild, ids: TopicIds, file: TaxonomyFile, write: boolean): Promise<Tally> {
  const tally = { ...ZERO };
  const slugOfSin = new Map([...ids.sins].map(([slug, id]) => [id, slug]));
  const slugOfDeed = new Map([...ids.deeds].map(([slug, id]) => [id, slug]));
  const sinRows = await prisma.sinQuote.findMany({
    where: { sinId: { in: [...ids.sins.values()] } },
    select: { id: true, sinId: true, quoteId: true, basis: true, classifiedBy: true, reviewStatus: true, note: true, relevanceScore: true, sectionId: true },
  });
  const deedRows = await prisma.goodDeedQuote.findMany({
    where: { goodDeedId: { in: [...ids.deeds.values()] } },
    select: { id: true, goodDeedId: true, quoteId: true, basis: true, classifiedBy: true, reviewStatus: true, note: true, relevanceScore: true, sectionId: true },
  });
  const current = new Map<string, StoredLink>();
  for (const row of sinRows) {
    const slug = slugOfSin.get(row.sinId);
    if (!slug) continue;
    current.set(`AVOID:${slug}:${row.quoteId}`, { ...row, ownerId: row.sinId, side: 'AVOID' });
  }
  for (const row of deedRows) {
    const slug = slugOfDeed.get(row.goodDeedId);
    if (!slug) continue;
    current.set(`DO:${slug}:${row.quoteId}`, { ...row, ownerId: row.goodDeedId, side: 'DO' });
  }
  const wanted = new Map(built.links.map((link) => [`${link.side}:${link.slug}:${link.quoteId}`, link]));
  const creates: Prisma.SinQuoteCreateManyInput[] = [];
  const deedCreates: Prisma.GoodDeedQuoteCreateManyInput[] = [];
  const sinUpdates: { id: string; data: Prisma.SinQuoteUncheckedUpdateInput }[] = [];
  const deedUpdates: { id: string; data: Prisma.GoodDeedQuoteUncheckedUpdateInput }[] = [];
  const sinDeletes: string[] = [];
  const deedDeletes: string[] = [];
  let missingTopics = 0;
  for (const [key, link] of wanted) {
    const row = current.get(key);
    const topicId = link.side === 'AVOID' ? ids.sins.get(link.slug) : ids.deeds.get(link.slug);
    if (!topicId) {
      if (write) throw new Error(`Missing topic row for ${link.slug}`);
      missingTopics += 1;
      continue;
    }
    const data = {
      basis: link.basis,
      classifiedBy: link.classifiedBy,
      reviewStatus: link.reviewStatus as LinkReviewStatus,
      note: link.note,
      relevanceScore: link.relevanceScore,
      sectionId: link.sectionId,
    };
    if (!row) {
      if (link.side === 'AVOID') creates.push({ sinId: topicId, quoteId: link.quoteId, ...data });
      else deedCreates.push({ goodDeedId: topicId, quoteId: link.quoteId, ...data });
    } else if (!sameLink(row, link)) {
      if (link.side === 'AVOID') sinUpdates.push({ id: row.id, data });
      else deedUpdates.push({ id: row.id, data });
    }
  }
  for (const [key, row] of current) {
    if (wanted.has(key)) continue;
    const drop = isOldNote(row.note, row.relevanceScore) || row.basis !== 'MANUAL';
    if (!drop) continue;
    if (row.side === 'AVOID') sinDeletes.push(row.id);
    else deedDeletes.push(row.id);
  }
  tally.created = creates.length + deedCreates.length + missingTopics;
  tally.updated = sinUpdates.length + deedUpdates.length;
  tally.deleted = sinDeletes.length + deedDeletes.length;
  if (!write) return tally;
  await inTransactionBatches(prisma, creates, async (tx, batch) => { await tx.sinQuote.createMany({ data: [...batch] }); });
  await inTransactionBatches(prisma, deedCreates, async (tx, batch) => { await tx.goodDeedQuote.createMany({ data: [...batch] }); });
  await inTransactionBatches(prisma, sinUpdates, async (tx, batch) => {
    for (const row of batch) await tx.sinQuote.update({ where: { id: row.id }, data: row.data });
  }, undefined, 200);
  await inTransactionBatches(prisma, deedUpdates, async (tx, batch) => {
    for (const row of batch) await tx.goodDeedQuote.update({ where: { id: row.id }, data: row.data });
  }, undefined, 200);
  for (const batch of chunks(sinDeletes, 500)) await prisma.sinQuote.deleteMany({ where: { id: { in: batch } } });
  for (const batch of chunks(deedDeletes, 500)) await prisma.goodDeedQuote.deleteMany({ where: { id: { in: batch } } });
  return tally;
}

function writeReports(built: LinkBuild, sections: readonly ReadySection[], quotes: Map<string, QuoteMeta>, content: ReturnType<typeof loadContentMap>): void {
  const docs = docsPath();
  const proposals = join(docs, 'proposals');
  mkdirSync(proposals, { recursive: true });
  for (const book of ['adab', 'bukhari', 'muslim'] as const) {
    const rows = built.proposals.filter((row) => sections.find((section) => section.id === row.sectionId)?.book === book);
    const lines = ['sectionId\ttitle\tslugs\tside\titems', ...rows.map((row) => [row.sectionId, row.title.replace(/\s+/g, ' '), row.slugs, row.side, row.items].join('\t'))];
    writeFileSync(join(proposals, `${book}.tsv`), `${lines.join('\n')}\n`);
  }
  const bySection = new Map(content.filter((row) => row.decision === 'ITEM').map((row) => [row.sectionId, row]));
  const lines = ['quoteId\tsection\ttext\tslugs\treason\tconfidence'];
  for (const section of sections) {
    if (!bySection.has(section.id)) continue;
    const textual = section.items.filter((item) => item.kind !== 'AUTHOR_TEXT' && item.quoteId);
    if (textual.length === 0) {
      lines.push(`\t${section.titleAr.replace(/\s+/g, ' ')}\t\t\tلا نص حديث أو آية في الباب\tlow`);
      continue;
    }
    for (const item of textual) {
      const decision = ITEM_DECISIONS[item.quoteId ?? ''] ?? { slugs: [], reason: 'لم يُراجع', confidence: 'low' as const };
      const text = (quotes.get(item.quoteId ?? '')?.textAr ?? '').replace(/\s+/g, ' ').slice(0, 120);
      lines.push([item.quoteId, section.titleAr.replace(/\s+/g, ' '), text, decision.slugs.join(','), decision.reason, decision.confidence].join('\t'));
    }
  }
  writeFileSync(join(docs, 'item-decisions.tsv'), `${lines.join('\n')}\n`);
}

export async function runTaxonomyImport(options: ImportOptions): Promise<void> {
  if (options.limit !== null) throw new Error('taxonomy import does not take --limit');
  const file = loadTaxonomy(yamlPath());
  const topics = topicBySlug(file.topics);
  for (const [quoteId, decision] of Object.entries(ITEM_DECISIONS)) {
    for (const slug of decision.slugs) if (!topics.has(slug)) throw new Error(`Item ${quoteId} names unknown slug ${slug}`);
  }
  const quotes = new Map<string, QuoteMeta>();
  const sections = await loadSections(options.prisma, quotes);
  const report = coverage(file.topics, sections);
  const problems = coverageDiff(report);
  if (problems.length > 0) throw new Error(`Taxonomy coverage is outside 2%:\n${problems.join('\n')}`);
  const content = loadContentMap(join(docsPath(), 'content-map.tsv'));
  const missing = content.filter((row) => !sections.some((section) => section.id === row.sectionId));
  if (missing.length > 0) throw new Error(`content-map section ids missing from the database: ${missing.slice(0, 5).map((row) => row.sectionId).join(', ')}`);
  const sahihaynMap = loadSahihaynMap();
  for (const row of sahihaynMap) {
    for (const slug of row.topics) {
      if (!topics.has(slug)) throw new Error(`sahihayn-map ${row.id} names unknown slug ${slug}`);
    }
  }
  const quoteIds = sections.flatMap((section) => section.items.flatMap((item) => item.quoteId ? [item.quoteId] : []));
  const strong = await strongMatches(options.prisma, quoteIds);
  const sahihayn = await sahihaynQuotes(options.prisma, strong);
  const built = buildLinks(topics, sections, content, strong, sahihayn, sahihaynMap);
  const titles = new Map(sections.filter((section) => section.book === 'kabair' && section.level === 'KABIRA' && section.kabiraNumber !== null).map((section) => [section.kabiraNumber as number, section.titleAr]));
  console.log(`coverage: targhib ${report.targhib.matched}/${report.targhib.eligible}, zuhd ${report.zuhd.matched}/${report.zuhd.eligible}, minhaj ${report.minhaj.matched}/${report.minhaj.eligible}, unmapped ${report.unmapped}`);
  console.log(`items: ${Object.entries(report.items).map(([slug, count]) => `${slug} ${count}`).join(', ')}`);
  console.log(`links planned: ${built.links.length}, proposals: ${built.proposals.length}, skipped items: ${built.skippedItems}`);
  const topicSync = await syncTopics(options.prisma, file, titles, !options.dryRun);
  const linkSync = await syncLinks(options.prisma, built, topicSync.ids, file, !options.dryRun);
  const tally = plus(topicSync.tally, linkSync);
  if (!options.dryRun) writeReports(built, sections, quotes, content);
  const mode = options.dryRun ? 'dry-run' : 'write';
  console.log(`taxonomy ${mode}: created=${tally.created} updated=${tally.updated} deleted=${tally.deleted}`);
  console.log(`taxonomy topics ${mode}: created=${topicSync.tally.created} updated=${topicSync.tally.updated} deleted=${topicSync.tally.deleted}`);
  console.log(`taxonomy links ${mode}: created=${linkSync.created} updated=${linkSync.updated} deleted=${linkSync.deleted}`);
}
