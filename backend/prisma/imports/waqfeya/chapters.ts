/**
 * Chapter titles become ChapterEntityMap suggestions (reviewed = false).
 * A near-miss is printed and not written. No SinQuote or GoodDeedQuote is created.
 */
import { ChapterMapTarget, type PrismaClient } from '@prisma/client';
import { matchChapterTitle, type NamedEntity } from '../adab-mufrad/parse.js';
import type { ParsedChapter } from './parse.js';
import { foldArabic } from './clean.js';

/** Stems that occur in too many titles to mark a near-miss on their own. */
const COMMON_STEMS = new Set([
  'الله',
  'رسول',
  'نبي',
  'الذين',
  'الذي',
  'عبد',
  'ابن',
  'قال',
  'عليه',
  'وسلم',
  'تعالي',
  'بين',
  'علي',
  'عند',
  'بعد',
  'قبل',
  'غير',
  'ذلك',
  'هذا',
  'هذه',
  'كان',
  'امر',
]);

function stemsOf(text: string): string[] {
  return foldArabic(text)
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^و(?=ال)/, '').replace(/^ال/, ''))
    .filter((token) => token.length >= 4 && !COMMON_STEMS.has(token));
}

/** A long sin name must share two distinctive stems, otherwise one common word lists every chapter. */
function usefulNearMiss(title: string, nameAr: string): boolean {
  const titleStems = new Set(stemsOf(title));
  const shared = stemsOf(nameAr).filter((token) => titleStems.has(token));
  if (shared.length === 0) return false;
  return nameAr.split(/\s+/).length <= 5 || shared.length >= 2;
}

export interface ChapterReport {
  created: number;
  existing: number;
  matches: string[];
  nearMisses: string[];
}

function subject(title: string): string {
  return title
    .replace(/^[0-9\u0660-\u0669\u06F0-\u06F9]+\s*[-–—\u0640]?\s*/, '')
    .replace(/^[()[\]«»]+\s*/, '')
    .replace(/^(?:كتاب|الترغيب في|الترهيب من|باب)\s+/, '');
}

async function loadEntities(prisma: PrismaClient): Promise<NamedEntity[]> {
  const where = { NOT: { slug: { startsWith: 'test-' } } };
  const [sins, deeds] = await Promise.all([
    prisma.sin.findMany({ where, select: { id: true, slug: true, nameAr: true } }),
    prisma.goodDeed.findMany({ where, select: { id: true, slug: true, nameAr: true } }),
  ]);
  return [
    ...sins.map((sin) => ({ ...sin, kind: 'SIN' as const })),
    ...deeds.map((deed) => ({ ...deed, kind: 'GOOD_DEED' as const })),
  ];
}

export async function suggestChapterMaps(
  prisma: PrismaClient,
  chapters: readonly ParsedChapter[],
  sourceId: string,
  write: boolean,
): Promise<ChapterReport> {
  const entities = await loadEntities(prisma);
  const report: ChapterReport = { created: 0, existing: 0, matches: [], nearMisses: [] };
  for (const chapter of chapters) {
    for (const match of matchChapterTitle(subject(chapter.titleAr), entities)) {
      const line = `${match.entity.kind} ${match.entity.nameAr} ← ${chapter.titleAr}`;
      if (match.kind === 'near-miss') {
        if (usefulNearMiss(subject(chapter.titleAr), match.entity.nameAr)) report.nearMisses.push(line);
        continue;
      }
      report.matches.push(line);
      if (!write) continue;
      const target =
        match.entity.kind === 'SIN'
          ? { targetType: ChapterMapTarget.SIN, sinId: match.entity.id }
          : { targetType: ChapterMapTarget.GOOD_DEED, goodDeedId: match.entity.id };
      const found = await prisma.chapterEntityMap.findFirst({
        where: { sourceId, chapterKey: chapter.key, ...target },
      });
      if (found) {
        report.existing += 1;
        continue;
      }
      await prisma.chapterEntityMap.create({
        data: {
          sourceId,
          chapterKey: chapter.key,
          chapterTitleAr: chapter.titleAr,
          reviewed: false,
          ...target,
        },
      });
      report.created += 1;
    }
  }
  return report;
}

export function printChapterReport(report: ChapterReport): void {
  console.log(`chapter-maps: created=${report.created} existing=${report.existing} matches=${report.matches.length} near-misses=${report.nearMisses.length}`);
  for (const line of report.matches) console.log(`MATCH ${line}`);
  for (const line of report.nearMisses) console.log(`NEAR ${line}`);
}
