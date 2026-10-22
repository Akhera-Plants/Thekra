/**
 * Topic themes: proposal + coverage report (reviewer tool, read-only).
 *
 *   pnpm taxonomy:themes            # coverage of topic-themes.yaml per topic
 *   pnpm taxonomy:themes --propose  # chapter-title clusters for topics with ≥ 10 texts
 *   pnpm taxonomy:themes --propose --topic tark-as-salah
 *   pnpm taxonomy:themes --untagged # top untagged chapter titles per topic
 *
 * Counts follow the reader rules (accepted, publishable, default grades,
 * verse / hadith / kept athar) and are distinct texts per topic.
 */
import { join } from 'node:path';
import { PrismaClient, QuoteType, type Prisma } from '@prisma/client';
import { GradePolicy } from '../../../src/modules/hadith/grade-policy.js';
import { publicAcceptedLinkWhere } from '../../../src/modules/classification/public-taxonomy.js';
import { chapterTitleFromNote, isGenericTitle, normTheme } from '../../../src/modules/taxonomy/topic-themes.js';
import { keysForLink, loadThemeLinks, loadThemesFile, themesByTopic, type ThemeLinkRow } from './themes.js';
import { loadTaxonomy, topicBySlug } from './yaml.js';

const MIN_TEXTS = 10;

const readerQuote: Prisma.QuoteWhereInput = {
  AND: [
    GradePolicy.readerClause(),
    GradePolicy.whereClause(GradePolicy.defaultAllowedGrades()),
    {
      OR: [
        { type: QuoteType.QURAN_VERSE },
        { type: QuoteType.HADITH, isAthar: false },
        { type: QuoteType.HADITH, isAthar: true, atharReviewDecision: 'KEEP' },
      ],
    },
  ],
};

/** «الكبيرة الرابعة والستون في …», «باب …», «(باب مشترك)», «الترهيب من …» → the subject words. */
export function cleanChapterTitle(title: string): string {
  return normTheme(
    title
      .replace(/\(باب مشترك\)/g, ' ')
      .replace(/^\s*باب\s+/, ' ')
      .replace(/^\s*الكبير[ةه]\s+\S+(\s+و\S+)?(\s+في)?\s+/, ' ')
      .replace(/^\s*فصل\s+(في\s+)?/, ' '),
  );
}

function chapterOf(row: ThemeLinkRow): string | null {
  const title = row.sectionTitle ?? chapterTitleFromNote(row.note);
  if (!title) return null;
  if (isGenericTitle(title)) return row.parentTitles[0] ?? null;
  return title;
}

const STOP = new Set(['من', 'في', 'علي', 'عن', 'الي', 'ما', 'و', 'او', 'ان', 'لا', 'به', 'بها', 'ذلك', 'الترهيب', 'الترغيب', 'باب', 'ما جاء', 'جاء', 'بيان', 'فضل']);

function tokens(title: string): Set<string> {
  return new Set(title.split(' ').filter((token) => token.length > 2 && !STOP.has(token)));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}

interface Cluster {
  label: string;
  members: Map<string, number>;
  quotes: Set<string>;
  tokens: Set<string>;
}

function propose(rows: ThemeLinkRow[]): Cluster[] {
  const byTitle = new Map<string, Set<string>>();
  for (const row of rows) {
    const chapter = chapterOf(row);
    if (!chapter) continue;
    const clean = cleanChapterTitle(chapter);
    if (!clean) continue;
    byTitle.set(clean, (byTitle.get(clean) ?? new Set()).add(row.quoteId));
  }
  const titles = [...byTitle.entries()].sort((a, b) => b[1].size - a[1].size);
  const clusters: Cluster[] = [];
  for (const [title, quotes] of titles) {
    const own = tokens(title);
    const home = clusters.find((cluster) => jaccard(cluster.tokens, own) >= 0.5);
    if (home) {
      home.members.set(title, quotes.size);
      for (const quote of quotes) home.quotes.add(quote);
      continue;
    }
    clusters.push({ label: title, members: new Map([[title, quotes.size]]), quotes: new Set(quotes), tokens: own });
  }
  return clusters.sort((a, b) => b.quotes.size - a.quotes.size);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const proposeMode = args.includes('--propose');
  const untaggedMode = args.includes('--untagged');
  const onlyTopic = args.includes('--topic') ? args[args.indexOf('--topic') + 1] ?? null : null;
  const prisma = new PrismaClient();
  try {
    const file = loadTaxonomy(join(process.cwd(), 'prisma', 'taxonomy', 'taxonomy.yaml'));
    const topics = topicBySlug(file.topics);
    const themes = loadThemesFile(topics);
    const byTopic = themesByTopic(themes);
    const visible = { isHidden: false, origin: { in: ['CURATED', 'TAXONOMY'] as ('CURATED' | 'TAXONOMY')[] } };
    const sins = await prisma.sin.findMany({ where: visible, select: { id: true, slug: true } });
    const deeds = await prisma.goodDeed.findMany({ where: visible, select: { id: true, slug: true } });
    const sinIds = new Map(sins.filter((row) => topics.has(row.slug)).map((row) => [row.slug, row.id]));
    const deedIds = new Map(deeds.filter((row) => topics.has(row.slug)).map((row) => [row.slug, row.id]));
    const reader = publicAcceptedLinkWhere();
    const [sinPublic, deedPublic] = await Promise.all([
      prisma.sinQuote.findMany({ where: { ...reader, quote: readerQuote, sinId: { in: [...sinIds.values()] } }, select: { id: true } }),
      prisma.goodDeedQuote.findMany({ where: { ...reader, quote: readerQuote, goodDeedId: { in: [...deedIds.values()] } }, select: { id: true } }),
    ]);
    const publicIds = new Set([...sinPublic, ...deedPublic].map((row) => row.id));
    const rows = (await loadThemeLinks(prisma, sinIds, deedIds)).filter((row) => publicIds.has(row.id));
    const perTopic = new Map<string, ThemeLinkRow[]>();
    for (const row of rows) perTopic.set(row.slug, [...(perTopic.get(row.slug) ?? []), row]);
    const ranked = [...perTopic.entries()]
      .map(([slug, links]) => ({ slug, links, texts: new Set(links.map((link) => link.quoteId)).size }))
      .filter((entry) => entry.texts >= MIN_TEXTS && (!onlyTopic || entry.slug === onlyTopic))
      .sort((a, b) => b.texts - a.texts);

    if (proposeMode) {
      for (const entry of ranked) {
        const topic = topics.get(entry.slug);
        console.log(`\n## ${entry.slug} (${topic?.side}) ${topic?.ar} — ${entry.texts} texts`);
        for (const cluster of propose(entry.links).slice(0, 10)) {
          const members = [...cluster.members.entries()].map(([title, count]) => `${title} (${count})`).join(' | ');
          console.log(`  ${String(cluster.quotes.size).padStart(4)}  ${members}`);
        }
      }
      return;
    }

    let missing = 0;
    console.log('topic\ttexts\tthemes (texts)\tuntagged');
    for (const entry of ranked) {
      const own = byTopic.get(entry.slug) ?? [];
      if (own.length === 0) missing += 1;
      const quotesByKey = new Map<string, Set<string>>();
      const tagged = new Set<string>();
      for (const link of entry.links) {
        for (const key of keysForLink(link, byTopic)) {
          quotesByKey.set(key, (quotesByKey.get(key) ?? new Set()).add(link.quoteId));
          tagged.add(link.quoteId);
        }
      }
      const cells = own.map((theme) => `${theme.ar} ${quotesByKey.get(theme.key)?.size ?? 0}`).join(' · ');
      const untagged = entry.texts - tagged.size;
      const share = Math.round((untagged / entry.texts) * 100);
      console.log(`${entry.slug}\t${entry.texts}\t${cells || '—'}\t${untagged} (${share}%)`);
      if (untaggedMode && untagged > 0) {
        const titles = new Map<string, Set<string>>();
        for (const link of entry.links) {
          if (tagged.has(link.quoteId)) continue;
          const title = cleanChapterTitle(chapterOf(link) ?? link.note ?? '—').slice(0, 90) || '—';
          titles.set(title, (titles.get(title) ?? new Set()).add(link.quoteId));
        }
        for (const [title, quotes] of [...titles.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 6)) {
          console.log(`    ${quotes.size}  ${title}`);
        }
      }
    }
    const empty = themes.filter((theme) => !rows.some((row) => keysForLink(row, byTopic).includes(theme.key)));
    console.log(`\ntopics ≥ ${MIN_TEXTS} texts: ${ranked.length}, without themes: ${missing}, themes: ${themes.length}, themes with no public text: ${empty.map((theme) => theme.key).join(', ') || 'none'}`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
