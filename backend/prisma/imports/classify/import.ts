/**
 * Classifies every stored chapter and links the narrations under it.
 * The same folded topic across books becomes one sin or one deed.
 */
import {
  ChapterMapTarget,
  EntityOrigin,
  FlagOrigin,
  FlagSeverity,
  FlagStatus,
  FlagType,
  LinkReviewStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import type { ImportOptions } from '../lib/cli.js';
import { chapterTargets, classifyChapter, topicKey, type ChapterClassification } from './classify.js';
import { sentenceAround, tafsirSupport } from './tafsir-link.js';

interface QuoteChapter {
  id: string;
  sourceId: string;
  sourceName: string;
  bookTitle: string | null;
  pageOrChapter: string | null;
  chapterTitle: string | null;
}

interface EntityRow {
  id: string;
  nameAr: string;
  origin: EntityOrigin;
  kind: 'AVOID' | 'DO';
}

const STOP = new Set(['الله', 'رسول', 'النبي', 'نبي', 'عبد', 'ابن', 'قال', 'الذين', 'هذا', 'ذلك', 'مسلم', 'بخاري']);

function displayTopic(title: string): string {
  const markers = ['الترهيب من', 'الترغيب في', 'النهي عن', 'الحث على', 'التحريم', 'تحريم', 'النهي', 'الترهيب', 'الترغيب', 'استحباب', 'الفضل', 'فضل', 'الحث', 'ذم', 'الكبيرة', 'الكبيره'];
  for (const marker of markers) {
    const at = title.indexOf(marker);
    if (at < 0) continue;
    const rest = title.slice(at + marker.length).replace(/^(?:\s|من|في|عن|على)+/, '').trim();
    if (rest) return rest;
  }
  return title.trim();
}

function slugOf(kind: 'AVOID' | 'DO', topic: string): string {
  const body = topicKey(topic).replace(/\s+/g, '-').replace(/[^\u0621-\u064A-]/g, '').slice(0, 48);
  return `${kind === 'AVOID' ? 'auto-sin' : 'auto-deed'}-${body || 'topic'}`;
}

function choose(row: QuoteChapter): { title: string; classification: ChapterClassification } | null {
  const specific = row.pageOrChapter || row.chapterTitle;
  const specificClass = classifyChapter(specific);
  if (specific && specificClass.kind !== 'NEUTRAL') return { title: specific, classification: specificClass };
  const bookClass = classifyChapter(row.bookTitle);
  if (row.bookTitle && bookClass.kind !== 'NEUTRAL') return { title: row.bookTitle, classification: bookClass };
  return null;
}

async function loadQuotes(prisma: PrismaClient): Promise<QuoteChapter[]> {
  const rows = await prisma.$queryRaw<QuoteChapter[]>`
    SELECT q.id, q."sourceId", s."nameAr" AS "sourceName",
           q."bookTitle", q."pageOrChapter",
           q."rawPayload"->>'chapterTitle' AS "chapterTitle"
    FROM "Quote" q
    JOIN "Source" s ON s.id = q."sourceId"
    WHERE q.type = 'HADITH'
  `;
  return rows;
}

async function loadEntities(prisma: PrismaClient): Promise<Map<string, EntityRow>> {
  const [sins, deeds] = await Promise.all([
    prisma.sin.findMany({ select: { id: true, nameAr: true, origin: true } }),
    prisma.goodDeed.findMany({ select: { id: true, nameAr: true, origin: true } }),
  ]);
  const byTopic = new Map<string, EntityRow>();
  const remember = (row: EntityRow): void => {
    const key = `${row.kind}:${topicKey(row.nameAr)}`;
    const current = byTopic.get(key);
    if (!current || (current.origin !== EntityOrigin.CURATED && row.origin === EntityOrigin.CURATED)) {
      byTopic.set(key, row);
    }
  };
  for (const sin of sins) remember({ ...sin, kind: 'AVOID' });
  for (const deed of deeds) remember({ ...deed, kind: 'DO' });
  return byTopic;
}

export async function runClassify(options: ImportOptions): Promise<void> {
  const quotes = await loadQuotes(options.prisma);
  const byTopic = await loadEntities(options.prisma);
  const knownSlugs = new Set([
    ...(await options.prisma.sin.findMany({ select: { slug: true } })).map((row) => row.slug),
    ...(await options.prisma.goodDeed.findMany({ select: { slug: true } })).map((row) => row.slug),
  ]);
  const classes = { AVOID: new Set<string>(), DO: new Set<string>(), NEUTRAL: new Set<string>(), AMBIGUOUS: new Set<string>() };
  const groups = new Map<string, { kind: 'AVOID' | 'DO'; topic: string; nameAr: string; explicit: boolean; quotes: Array<{ id: string; note: string }> }>();
  const flags: Prisma.QuoteFlagCreateManyInput[] = [];

  for (const quote of quotes) {
    const chosen = choose(quote);
    const title = chosen?.title ?? quote.pageOrChapter ?? quote.chapterTitle ?? quote.bookTitle ?? '';
    if (!chosen) {
      if (title) classes.NEUTRAL.add(title);
      continue;
    }
    classes[chosen.classification.kind].add(title);
    if (chosen.classification.kind === 'AMBIGUOUS') {
      flags.push({
        quoteId: quote.id,
        type: FlagType.AMBIGUOUS_CHAPTER,
        severity: FlagSeverity.MEDIUM,
        source: FlagOrigin.AUTO,
        status: FlagStatus.OPEN,
        details: { chapter: title },
      });
    }
    for (const target of chapterTargets(title)) {
      const key = `${target.kind}:${topicKey(target.topic)}`;
      const group = groups.get(key) ?? {
        kind: target.kind,
        topic: target.topic,
        nameAr: displayTopic(title),
        explicit: target.explicit,
        quotes: [],
      };
      if (!group.explicit && target.explicit) group.explicit = true;
      if (displayTopic(title).length < group.nameAr.length) group.nameAr = displayTopic(title);
      group.quotes.push({ id: quote.id, note: `باب ${title} — ${quote.sourceName}` });
      groups.set(key, group);
    }
  }

  let entitiesCreated = 0;
  const sinLinks: Prisma.SinQuoteCreateManyInput[] = [];
  const deedLinks: Prisma.GoodDeedQuoteCreateManyInput[] = [];

  for (const [key, group] of groups) {
    if (STOP.has(topicKey(group.topic))) continue;
    let entity = byTopic.get(key);
    if (!entity && !options.dryRun) {
      const slug = slugOf(group.kind, group.topic);
      if (group.kind === 'AVOID') {
        const saved = await options.prisma.sin.upsert({
          where: { slug },
          create: { slug, name: group.nameAr, nameAr: group.nameAr, origin: EntityOrigin.AUTO_CHAPTER },
          update: {},
          select: { id: true, nameAr: true, origin: true },
        });
        if (!knownSlugs.has(slug)) entitiesCreated += 1;
        knownSlugs.add(slug);
        entity = { ...saved, kind: 'AVOID' };
      } else {
        const saved = await options.prisma.goodDeed.upsert({
          where: { slug },
          create: { slug, name: group.nameAr, nameAr: group.nameAr, origin: EntityOrigin.AUTO_CHAPTER },
          update: {},
          select: { id: true, nameAr: true, origin: true },
        });
        if (!knownSlugs.has(slug)) entitiesCreated += 1;
        knownSlugs.add(slug);
        entity = { ...saved, kind: 'DO' };
      }
      byTopic.set(key, entity);
    }
    if (!entity) continue;
    const status = group.explicit ? LinkReviewStatus.ACCEPTED : LinkReviewStatus.NOT_REVIEWED;
    for (const quote of group.quotes) {
      const link = { quoteId: quote.id, reviewStatus: status, note: quote.note.slice(0, 500) };
      if (entity.kind === 'AVOID') sinLinks.push({ ...link, sinId: entity.id });
      else deedLinks.push({ ...link, goodDeedId: entity.id });
    }
  }

  const sinBefore = await options.prisma.sinQuote.count();
  const deedBefore = await options.prisma.goodDeedQuote.count();
  const flagBefore = await options.prisma.quoteFlag.count({ where: { type: FlagType.AMBIGUOUS_CHAPTER, status: FlagStatus.OPEN } });
  if (!options.dryRun) {
    for (let index = 0; index < sinLinks.length; index += 500) {
      await options.prisma.sinQuote.createMany({ data: sinLinks.slice(index, index + 500), skipDuplicates: true });
    }
    for (let index = 0; index < deedLinks.length; index += 500) {
      await options.prisma.goodDeedQuote.createMany({ data: deedLinks.slice(index, index + 500), skipDuplicates: true });
    }
    const openFlags = new Set((await options.prisma.quoteFlag.findMany({
      where: { type: FlagType.AMBIGUOUS_CHAPTER, status: FlagStatus.OPEN },
      select: { quoteId: true },
    })).map((row) => row.quoteId));
    const fresh = flags.filter((flag) => !openFlags.has(flag.quoteId));
    for (let index = 0; index < fresh.length; index += 500) {
      await options.prisma.quoteFlag.createMany({ data: fresh.slice(index, index + 500) });
    }
  }
  const sinCreated = (await options.prisma.sinQuote.count()) - sinBefore;
  const deedCreated = (await options.prisma.goodDeedQuote.count()) - deedBefore;
  const flagsCreated = (await options.prisma.quoteFlag.count({ where: { type: FlagType.AMBIGUOUS_CHAPTER, status: FlagStatus.OPEN } })) - flagBefore;

  const maps = await options.prisma.chapterEntityMap.findMany({
    where: { reviewed: false },
    include: { sin: { select: { nameAr: true } }, goodDeed: { select: { nameAr: true } } },
  });
  let mapsReviewed = 0;
  for (const map of maps) {
    const classified = classifyChapter(map.chapterTitleAr);
    const name = map.targetType === ChapterMapTarget.SIN ? map.sin?.nameAr : map.goodDeed?.nameAr;
    const agrees = classified.explicit && name != null && topicKey(name) === topicKey(classified.topic ?? '')
      && ((classified.kind === 'AVOID' && map.targetType === ChapterMapTarget.SIN)
        || (classified.kind === 'DO' && map.targetType === ChapterMapTarget.GOOD_DEED));
    if (!agrees || options.dryRun) continue;
    await options.prisma.chapterEntityMap.update({ where: { id: map.id }, data: { reviewed: true } });
    mapsReviewed += 1;
  }

  const tafsir = await linkTafsir(options, byTopic);
  const summary = {
    chapters: { AVOID: classes.AVOID.size, DO: classes.DO.size, NEUTRAL: classes.NEUTRAL.size, AMBIGUOUS: classes.AMBIGUOUS.size },
    entitiesCreated,
    links: { sins: sinCreated, deeds: deedCreated },
    ambiguousFlags: flagsCreated,
    mapsReviewed,
    mapsLeft: maps.length - mapsReviewed,
    tafsir,
  };
  console.log(JSON.stringify(summary, null, 2));
}

async function linkTafsir(
  options: ImportOptions,
  byTopic: Map<string, EntityRow>,
): Promise<{ accepted: number; weak: number }> {
  const entities = [...byTopic.values()].filter((entity) => {
    const key = topicKey(entity.nameAr);
    return key.length >= 4 && !STOP.has(key);
  });
  const passages = await options.prisma.explanation.findMany({
    where: { apiProvider: 'quran.com', externalId: { startsWith: '91:' } },
    select: { ayahKey: true, text: true },
  });
  const verses = await options.prisma.quote.findMany({
    where: { type: 'QURAN_VERSE', externalId: { not: null } },
    select: { id: true, externalId: true, surahNameAr: true, ayahNumber: true },
  });
  const verseByKey = new Map(verses.map((verse) => [verse.externalId, verse]));
  const sinLinks: Prisma.SinQuoteCreateManyInput[] = [];
  const deedLinks: Prisma.GoodDeedQuoteCreateManyInput[] = [];
  const flags: Prisma.QuoteFlagCreateManyInput[] = [];

  for (const passage of passages) {
    if (!passage.ayahKey) continue;
    const verse = verseByKey.get(passage.ayahKey);
    if (!verse) continue;
    for (const entity of entities) {
      const support = tafsirSupport(passage.text, entity.nameAr, entity.kind);
      if (support === 'NONE') continue;
      const sentence = sentenceAround(passage.text, entity.nameAr);
      if (!sentence) continue;
      const ayah = passage.ayahKey.split(':')[1] ?? String(verse.ayahNumber ?? '');
      const note = `${sentence} تفسير السعدي، ${verse.surahNameAr ?? ''} ${ayah}`.replace(/\s+/g, ' ').trim().slice(0, 500);
      const status = support === 'ACCEPTED' ? LinkReviewStatus.ACCEPTED : LinkReviewStatus.NOT_REVIEWED;
      const link = { quoteId: verse.id, reviewStatus: status, note };
      if (entity.kind === 'AVOID') sinLinks.push({ ...link, sinId: entity.id });
      else deedLinks.push({ ...link, goodDeedId: entity.id });
      if (support === 'WEAK') {
        flags.push({
          quoteId: verse.id,
          type: FlagType.WEAK_TAFSIR_SUPPORT,
          severity: FlagSeverity.LOW,
          source: FlagOrigin.AUTO,
          status: FlagStatus.OPEN,
          details: { ayahKey: passage.ayahKey, entityId: entity.id },
        });
      }
    }
  }

  if (options.dryRun) return { accepted: 0, weak: 0 };
  const before = await options.prisma.sinQuote.count() + await options.prisma.goodDeedQuote.count();
  for (let index = 0; index < sinLinks.length; index += 500) {
    await options.prisma.sinQuote.createMany({ data: sinLinks.slice(index, index + 500), skipDuplicates: true });
  }
  for (let index = 0; index < deedLinks.length; index += 500) {
    await options.prisma.goodDeedQuote.createMany({ data: deedLinks.slice(index, index + 500), skipDuplicates: true });
  }
  await writeArabicNotes(options.prisma, 'SinQuote', 'sinId', sinLinks);
  await writeArabicNotes(options.prisma, 'GoodDeedQuote', 'goodDeedId', deedLinks);
  const open = new Set((await options.prisma.quoteFlag.findMany({
    where: { type: FlagType.WEAK_TAFSIR_SUPPORT, status: FlagStatus.OPEN },
    select: { quoteId: true, details: true },
  })).map((row) => `${row.quoteId}:${(row.details as { entityId?: string } | null)?.entityId ?? ''}`));
  const fresh = flags.filter((flag) => !open.has(`${flag.quoteId}:${(flag.details as { entityId?: string }).entityId ?? ''}`));
  for (let index = 0; index < fresh.length; index += 500) {
    await options.prisma.quoteFlag.createMany({ data: fresh.slice(index, index + 500) });
  }
  const after = await options.prisma.sinQuote.count() + await options.prisma.goodDeedQuote.count();
  return { accepted: sinLinks.filter((link) => link.reviewStatus === LinkReviewStatus.ACCEPTED).length + deedLinks.filter((link) => link.reviewStatus === LinkReviewStatus.ACCEPTED).length, weak: after - before };
}

/** An existing verse link keeps its review, and gains the Sa'di sentence when its note is still the English seed. */
async function writeArabicNotes(
  prisma: PrismaClient,
  table: 'SinQuote' | 'GoodDeedQuote',
  idColumn: 'sinId' | 'goodDeedId',
  links: Array<{ note?: string | null; quoteId: string; sinId?: string; goodDeedId?: string }>,
): Promise<void> {
  const rows = links.filter((link) => link.note?.includes('تفسير السعدي'));
  for (let index = 0; index < rows.length; index += 200) {
    const batch = rows.slice(index, index + 200);
    const values = Prisma.join(batch.map((row) => {
      const entityId = (idColumn === 'sinId' ? row.sinId : row.goodDeedId) ?? '';
      return Prisma.sql`(${entityId}, ${row.quoteId}, ${row.note ?? ''})`;
    }));
    const noteIsEnglish = Prisma.sql`position('تفسير السعدي' in coalesce(link.note, '')) = 0`;
    if (table === 'SinQuote') {
      await prisma.$executeRaw`
        UPDATE "SinQuote" AS link
        SET note = incoming.note
        FROM (VALUES ${values}) AS incoming(entity_id, quote_id, note)
        WHERE link."sinId"::text = incoming.entity_id
          AND link."quoteId"::text = incoming.quote_id
          AND ${noteIsEnglish}`;
    } else {
      await prisma.$executeRaw`
        UPDATE "GoodDeedQuote" AS link
        SET note = incoming.note
        FROM (VALUES ${values}) AS incoming(entity_id, quote_id, note)
        WHERE link."goodDeedId"::text = incoming.entity_id
          AND link."quoteId"::text = incoming.quote_id
          AND ${noteIsEnglish}`;
    }
  }
}
