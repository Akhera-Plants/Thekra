import { readFileSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import { inTransactionBatches } from '../lib/batch.js';
import {
  matchThemeKeys,
  parseTopicThemes,
  themeHaystack,
  topicThemesPath,
  type TopicTheme,
} from '../../../src/modules/taxonomy/topic-themes.js';
import type { Topic } from './yaml.js';

export interface ThemeLinkRow {
  id: string;
  side: 'AVOID' | 'DO';
  slug: string;
  quoteId: string;
  note: string | null;
  sectionTitle: string | null;
  parentTitles: string[];
  themeKeys: string[];
}

export function loadThemesFile(topics: ReadonlyMap<string, Topic>): TopicTheme[] {
  let source = '';
  try {
    source = readFileSync(topicThemesPath(), 'utf8');
  } catch {
    return [];
  }
  const themes = parseTopicThemes(source);
  for (const theme of themes) {
    if (!topics.has(theme.topic)) throw new Error(`topic-themes ${theme.key} names unknown topic ${theme.topic}`);
  }
  return themes;
}

/** Every link of the given topics with the chapter headings a theme is matched against. */
export async function loadThemeLinks(
  prisma: PrismaClient,
  sinIds: ReadonlyMap<string, string>,
  deedIds: ReadonlyMap<string, string>,
): Promise<ThemeLinkRow[]> {
  const slugOfSin = new Map([...sinIds].map(([slug, id]) => [id, slug]));
  const slugOfDeed = new Map([...deedIds].map(([slug, id]) => [id, slug]));
  const select = { id: true, quoteId: true, note: true, sectionId: true, themeKeys: true } as const;
  const sins = await prisma.sinQuote.findMany({ where: { sinId: { in: [...sinIds.values()] } }, select: { ...select, sinId: true } });
  const deeds = await prisma.goodDeedQuote.findMany({ where: { goodDeedId: { in: [...deedIds.values()] } }, select: { ...select, goodDeedId: true } });
  const sectionIds = new Set<string>();
  for (const row of [...sins, ...deeds]) if (row.sectionId) sectionIds.add(row.sectionId);
  const sections = new Map<string, { titleAr: string; parentId: string | null }>();
  let pending = [...sectionIds];
  while (pending.length > 0) {
    const rows = await prisma.bookSection.findMany({ where: { id: { in: pending } }, select: { id: true, titleAr: true, parentId: true } });
    for (const row of rows) sections.set(row.id, { titleAr: row.titleAr, parentId: row.parentId });
    pending = [...new Set(rows.flatMap((row) => (row.parentId && !sections.has(row.parentId) ? [row.parentId] : [])))];
  }
  const parents = (sectionId: string | null): string[] => {
    const titles: string[] = [];
    let at = sectionId ? sections.get(sectionId)?.parentId ?? null : null;
    const seen = new Set<string>();
    while (at && !seen.has(at)) {
      seen.add(at);
      const parent = sections.get(at);
      if (!parent) break;
      titles.push(parent.titleAr);
      at = parent.parentId;
    }
    return titles;
  };
  const shape = (row: (typeof sins)[number] | (typeof deeds)[number], side: 'AVOID' | 'DO', slug: string): ThemeLinkRow => ({
    id: row.id,
    side,
    slug,
    quoteId: row.quoteId,
    note: row.note,
    sectionTitle: row.sectionId ? sections.get(row.sectionId)?.titleAr ?? null : null,
    parentTitles: parents(row.sectionId),
    themeKeys: row.themeKeys,
  });
  return [
    ...sins.flatMap((row) => {
      const slug = slugOfSin.get(row.sinId);
      return slug ? [shape(row, 'AVOID', slug)] : [];
    }),
    ...deeds.flatMap((row) => {
      const slug = slugOfDeed.get(row.goodDeedId);
      return slug ? [shape(row, 'DO', slug)] : [];
    }),
  ];
}

export function keysForLink(row: Pick<ThemeLinkRow, 'slug' | 'note' | 'sectionTitle' | 'parentTitles'>, byTopic: ReadonlyMap<string, TopicTheme[]>): string[] {
  const themes = byTopic.get(row.slug);
  if (!themes || themes.length === 0) return [];
  return matchThemeKeys(themes, themeHaystack(row));
}

export function themesByTopic(themes: readonly TopicTheme[]): Map<string, TopicTheme[]> {
  const index = new Map<string, TopicTheme[]>();
  for (const theme of themes) index.set(theme.topic, [...(index.get(theme.topic) ?? []), theme]);
  return index;
}

function sameKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

/** Writes each link's theme keys. Idempotent: rows whose keys already match are left alone. */
export async function syncThemeKeys(
  prisma: PrismaClient,
  themes: readonly TopicTheme[],
  sinIds: ReadonlyMap<string, string>,
  deedIds: ReadonlyMap<string, string>,
  write: boolean,
): Promise<{ updated: number; tagged: number; links: number }> {
  const byTopic = themesByTopic(themes);
  const rows = await loadThemeLinks(prisma, sinIds, deedIds);
  const sinUpdates: { id: string; keys: string[] }[] = [];
  const deedUpdates: { id: string; keys: string[] }[] = [];
  let tagged = 0;
  for (const row of rows) {
    const keys = keysForLink(row, byTopic);
    if (keys.length > 0) tagged += 1;
    if (sameKeys(row.themeKeys, keys)) continue;
    (row.side === 'AVOID' ? sinUpdates : deedUpdates).push({ id: row.id, keys });
  }
  if (write) {
    await inTransactionBatches(prisma, sinUpdates, async (tx, batch) => {
      for (const row of batch) await tx.sinQuote.update({ where: { id: row.id }, data: { themeKeys: row.keys } });
    }, undefined, 200);
    await inTransactionBatches(prisma, deedUpdates, async (tx, batch) => {
      for (const row of batch) await tx.goodDeedQuote.update({ where: { id: row.id }, data: { themeKeys: row.keys } });
    }, undefined, 200);
  }
  return { updated: sinUpdates.length + deedUpdates.length, tagged, links: rows.length };
}
