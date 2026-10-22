/**
 * Reviewer keep/drop for the verse links in docs/taxonomy/ayah-review-decisions.tsv.
 * A drop is remembered by link id and by (section, topic, verse) so a later
 * taxonomy run cannot recreate it. A keep stays ACCEPTED and is classified
 * by the reviewer; its basis is left as the importer built it.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import type { DesiredLink } from './links.js';

export const AYAH_DECISIONS_FILE = 'ayah-review-decisions.tsv';
export const AYAH_DROPPED_FILE = 'ayah-dropped.tsv';

export interface AyahDecision {
  linkId: string;
  topicSlug: string;
  verseKey: string;
  decision: 'keep' | 'drop';
  reason: string;
}

export interface DroppedAyah {
  linkId: string;
  sectionId: string;
  side: 'DO' | 'AVOID';
  topicSlug: string;
  verseKey: string;
  quoteId: string;
}

export function parseAyahDecisions(text: string): AyahDecision[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const body = lines[0]?.startsWith('linkId\t') ? lines.slice(1) : lines;
  return body.map((line) => {
    const [linkId, topicSlug, verseKey, decision, reason] = line.split('\t');
    if (!linkId || !topicSlug || !verseKey) throw new Error(`Bad ayah decision row: ${line}`);
    if (decision !== 'keep' && decision !== 'drop') {
      throw new Error(`Ayah ${linkId}: decision must be keep or drop`);
    }
    return {
      linkId,
      topicSlug,
      verseKey,
      decision,
      reason: reason ?? '',
    };
  });
}

export function parseDroppedAyahs(text: string): DroppedAyah[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const body = lines[0]?.startsWith('linkId\t') ? lines.slice(1) : lines;
  return body.map((line) => {
    const [linkId, sectionId, side, topicSlug, verseKey, quoteId] = line.split('\t');
    if (side !== 'DO' && side !== 'AVOID') throw new Error(`Bad dropped ayah side on ${linkId}`);
    return {
      linkId: linkId ?? '',
      sectionId: sectionId ?? '',
      side,
      topicSlug: topicSlug ?? '',
      verseKey: verseKey ?? '',
      quoteId: quoteId ?? '',
    };
  });
}

/** Topic + verse. One accepted link per topic and quote, so this does not come back. */
export function ayahTopicVerse(topicSlug: string, verseKey: string): string {
  return `${topicSlug}|${verseKey}`;
}

export function verseKeyFromQuote(quote: {
  type: string;
  surahNumber: number | null;
  ayahNumber: number | null;
} | undefined): string | null {
  if (!quote || quote.type !== 'QURAN_VERSE') return null;
  if (quote.surahNumber == null || quote.ayahNumber == null) return null;
  return `${quote.surahNumber}:${quote.ayahNumber}`;
}

/**
 * Remove dropped topic/verse links. Kept links stay, with classifiedBy REVIEWER
 * and the basis the builder already chose.
 */
export function reviewAyahLinks<T extends DesiredLink>(
  links: readonly T[],
  dropped: ReadonlySet<string>,
  kept: ReadonlySet<string>,
  verseKeyOf: (quoteId: string) => string | null,
): T[] {
  const out: T[] = [];
  for (const link of links) {
    const verseKey = verseKeyOf(link.quoteId);
    if (!verseKey) {
      out.push(link);
      continue;
    }
    const key = ayahTopicVerse(link.slug, verseKey);
    if (dropped.has(key)) continue;
    if (kept.has(key)) out.push({ ...link, classifiedBy: 'REVIEWER' });
    else out.push(link);
  }
  return out;
}

export const VERSE_COUNT_TOPICS = [
  'sabr',
  'muraqaba',
  'khawf-raja',
  'shukr',
  'tawakkul',
  'muhasaba',
  'ikhlas',
  'mahabbat-allah',
  'wara',
  'quran',
  'zakah',
  'salah',
  'dhikr',
  'tawba',
  'satr-muslim',
  'dua',
] as const;

/** Accepted Quran links per topic, one count per verse. */
export async function countAcceptedVerses(
  prisma: PrismaClient,
  slugs: readonly string[],
): Promise<Map<string, number>> {
  const [deeds, sins] = await Promise.all([
    prisma.goodDeed.findMany({ where: { slug: { in: [...slugs] } }, select: { id: true, slug: true } }),
    prisma.sin.findMany({ where: { slug: { in: [...slugs] } }, select: { id: true, slug: true } }),
  ]);
  const slugOf = new Map<string, string>();
  for (const row of deeds) slugOf.set(row.id, row.slug);
  for (const row of sins) slugOf.set(row.id, row.slug);
  const [deedLinks, sinLinks] = await Promise.all([
    deeds.length === 0
      ? Promise.resolve([])
      : prisma.goodDeedQuote.findMany({
          where: {
            goodDeedId: { in: deeds.map((row) => row.id) },
            reviewStatus: 'ACCEPTED',
            quote: { type: 'QURAN_VERSE' },
          },
          select: { goodDeedId: true, quote: { select: { surahNumber: true, ayahNumber: true } } },
        }),
    sins.length === 0
      ? Promise.resolve([])
      : prisma.sinQuote.findMany({
          where: {
            sinId: { in: sins.map((row) => row.id) },
            reviewStatus: 'ACCEPTED',
            quote: { type: 'QURAN_VERSE' },
          },
          select: { sinId: true, quote: { select: { surahNumber: true, ayahNumber: true } } },
        }),
  ]);
  const verses = new Map<string, Set<string>>();
  for (const slug of slugs) verses.set(slug, new Set());
  for (const row of deedLinks) {
    const slug = slugOf.get(row.goodDeedId);
    if (!slug) continue;
    verses.get(slug)?.add(`${row.quote.surahNumber}:${row.quote.ayahNumber}`);
  }
  for (const row of sinLinks) {
    const slug = slugOf.get(row.sinId);
    if (!slug) continue;
    verses.get(slug)?.add(`${row.quote.surahNumber}:${row.quote.ayahNumber}`);
  }
  return new Map([...verses].map(([slug, keys]) => [slug, keys.size]));
}

function droppedText(rows: readonly DroppedAyah[]): string {
  const lines = ['linkId\tsectionId\tside\ttopicSlug\tverseKey\tquoteId'];
  const sorted = [...rows].sort((a, b) => a.linkId.localeCompare(b.linkId));
  for (const row of sorted) {
    lines.push([row.linkId, row.sectionId, row.side, row.topicSlug, row.verseKey, row.quoteId].join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

export async function loadAyahReview(
  prisma: PrismaClient,
  docsDir: string,
  write: boolean,
): Promise<{ dropped: Set<string>; kept: Set<string>; keepCount: number; dropCount: number }> {
  const decisions = parseAyahDecisions(readFileSync(join(docsDir, AYAH_DECISIONS_FILE), 'utf8'));
  const keepCount = decisions.filter((row) => row.decision === 'keep').length;
  const dropCount = decisions.filter((row) => row.decision === 'drop').length;
  if (decisions.length !== 491 || keepCount !== 250 || dropCount !== 241) {
    throw new Error(`Ayah decisions are ${decisions.length} (keep ${keepCount}, drop ${dropCount}), expected 491 (250/241)`);
  }

  const droppedPath = join(docsDir, AYAH_DROPPED_FILE);
  const storedDrops = existsSync(droppedPath) ? parseDroppedAyahs(readFileSync(droppedPath, 'utf8')) : [];
  const byLink = new Map(storedDrops.map((row) => [row.linkId, row]));

  const ids = decisions.map((row) => row.linkId);
  const [deeds, sins] = await Promise.all([
    prisma.goodDeedQuote.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sectionId: true,
        quoteId: true,
        goodDeed: { select: { slug: true } },
        quote: { select: { surahNumber: true, ayahNumber: true } },
      },
    }),
    prisma.sinQuote.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sectionId: true,
        quoteId: true,
        sin: { select: { slug: true } },
        quote: { select: { surahNumber: true, ayahNumber: true } },
      },
    }),
  ]);

  const live = new Map<string, { sectionId: string; quoteId: string; slug: string; verseKey: string; side: 'DO' | 'AVOID' }>();
  for (const row of deeds) {
    if (!row.sectionId) throw new Error(`Ayah link ${row.id} has no source section`);
    live.set(row.id, {
      sectionId: row.sectionId,
      quoteId: row.quoteId,
      slug: row.goodDeed.slug,
      verseKey: `${row.quote.surahNumber}:${row.quote.ayahNumber}`,
      side: 'DO',
    });
  }
  for (const row of sins) {
    if (!row.sectionId) throw new Error(`Ayah link ${row.id} has no source section`);
    live.set(row.id, {
      sectionId: row.sectionId,
      quoteId: row.quoteId,
      slug: row.sin.slug,
      verseKey: `${row.quote.surahNumber}:${row.quote.ayahNumber}`,
      side: 'AVOID',
    });
  }

  const dropped = new Set(storedDrops.map((row) => ayahTopicVerse(row.topicSlug, row.verseKey)));
  const kept = new Set<string>();
  const nextDrops = new Map(byLink);

  for (const decision of decisions) {
    const row = live.get(decision.linkId);
    if (row) {
      if (row.slug !== decision.topicSlug || row.verseKey !== decision.verseKey) {
        throw new Error(`Ayah ${decision.linkId} is ${row.slug} ${row.verseKey}, decision says ${decision.topicSlug} ${decision.verseKey}`);
      }
    }
    if (decision.decision === 'drop') {
      const known = row
        ? {
            linkId: decision.linkId,
            sectionId: row.sectionId,
            side: row.side,
            topicSlug: row.slug,
            verseKey: row.verseKey,
            quoteId: row.quoteId,
          }
        : nextDrops.get(decision.linkId);
      if (!known) throw new Error(`Dropped ayah ${decision.linkId} is neither in the database nor the exclusion list`);
      nextDrops.set(decision.linkId, known);
      dropped.add(ayahTopicVerse(known.topicSlug, known.verseKey));
    } else if (!row) {
      throw new Error(`Kept ayah ${decision.linkId} is missing`);
    } else {
      kept.add(ayahTopicVerse(row.slug, row.verseKey));
    }
  }

  if (write) writeFileSync(droppedPath, droppedText([...nextDrops.values()]));
  return { dropped, kept, keepCount, dropCount };
}
