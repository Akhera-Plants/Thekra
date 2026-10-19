import { readFileSync } from 'node:fs';
import {
  aiNote,
  chapterNote,
  ayahNote,
  keywordNote,
  linkPriority,
  munajjidNote,
  reviewerNote,
  takhrijNote,
} from './notes.js';
import { ITEM_DECISIONS } from './decisions.js';
import type { MatchSection } from './match.js';
import { keywordSide } from './match.js';
import type { SahihaynMapRow } from './sahihayn-map.js';
import type { Topic, TopicSide } from './yaml.js';

export interface LinkItem {
  order: number;
  kind: 'AYAH' | 'HADITH' | 'AUTHOR_TEXT';
  quoteId: string | null;
  /** 90 for an ayah, 80 for a public hadith, 50 otherwise. */
  score: number;
}

export interface ReadySection extends MatchSection {
  page: string | null;
  items: LinkItem[];
  anchorSlugs: readonly string[];
  keywordSlugs: readonly string[];
}

export interface ContentRow {
  sectionId: string;
  book: string;
  titleAr: string;
  items: number;
  decision: 'TOPICS' | 'ITEM' | 'SKIP';
  topics: string[];
  reason: string;
}

export interface DesiredLink {
  side: TopicSide;
  slug: string;
  quoteId: string;
  basis: 'CHAPTER' | 'CHAPTER_AYAH' | 'TAKHRIJ' | 'AUTHOR_CITATION' | 'REVIEWER_SECTION' | 'AI_ITEM' | 'KEYWORD_PROPOSAL';
  classifiedBy: 'BOOK' | 'REVIEWER' | 'AI';
  reviewStatus: 'ACCEPTED' | 'NOT_REVIEWED';
  note: string;
  relevanceScore: number;
  sectionId: string;
  sectionOrder: number;
  itemOrder: number;
  priority: number;
}

export interface ProposalRow {
  sectionId: string;
  title: string;
  slugs: string;
  side: string;
  items: number;
}

export interface StrongHit {
  book: 'BUKHARI' | 'MUSLIM';
  number: number;
}

export interface LinkBuild {
  links: DesiredLink[];
  proposals: ProposalRow[];
  skippedItems: number;
}

function better(current: DesiredLink, next: DesiredLink): DesiredLink {
  if (next.priority !== current.priority) return next.priority > current.priority ? next : current;
  if (next.relevanceScore !== current.relevanceScore) return next.relevanceScore > current.relevanceScore ? next : current;
  if (next.sectionOrder !== current.sectionOrder) return next.sectionOrder < current.sectionOrder ? next : current;
  return next.itemOrder < current.itemOrder ? next : current;
}

function collapse(links: readonly DesiredLink[]): DesiredLink[] {
  const kept = new Map<string, DesiredLink>();
  for (const link of links) {
    const key = `${link.side}:${link.slug}:${link.quoteId}`;
    const current = kept.get(key);
    kept.set(key, current ? better(current, link) : link);
  }
  return [...kept.values()];
}

function topicOf(topics: ReadonlyMap<string, Topic>, slug: string): Topic {
  const topic = topics.get(slug);
  if (!topic) throw new Error(`Unknown topic slug ${slug}`);
  return topic;
}

export function parseContentMap(text: string): ContentRow[] {
  const rows: ContentRow[] = [];
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [sectionId, book, titleAr, items, decision, topics, reason] = line.split('\t');
    if (decision !== 'TOPICS' && decision !== 'ITEM' && decision !== 'SKIP') {
      throw new Error(`Bad content-map decision ${decision} on ${sectionId}`);
    }
    rows.push({
      sectionId: sectionId ?? '',
      book: book ?? '',
      titleAr: titleAr ?? '',
      items: Number(items ?? 0),
      decision,
      topics: (topics ?? '').split(',').map((slug) => slug.trim()).filter((slug) => slug.length > 0),
      reason: reason ?? '',
    });
  }
  const counts = { TOPICS: 0, ITEM: 0, SKIP: 0 };
  for (const row of rows) counts[row.decision] += 1;
  if (rows.length !== 384 || counts.TOPICS !== 302 || counts.ITEM !== 15 || counts.SKIP !== 67) {
    throw new Error(`content-map is ${rows.length} rows (${counts.TOPICS}/${counts.ITEM}/${counts.SKIP}), expected 384 (302/15/67)`);
  }
  return rows;
}

export function loadContentMap(path: string): ContentRow[] {
  return parseContentMap(readFileSync(path, 'utf8'));
}

/**
 * Al-Kabair «فصل» sub-sections hold stories and exhortation. Keep AYAH links only
 * from the KABIRA opening itself; hadith under those فصل stays.
 */
export function skipKabairFaslAyah(section: Pick<ReadySection, 'book' | 'level'>, kind: LinkItem['kind']): boolean {
  return section.book === 'kabair' && section.level === 'FASL' && kind === 'AYAH';
}

function pushItemLinks(
  out: DesiredLink[],
  section: ReadySection,
  topics: ReadonlyMap<string, Topic>,
  slugs: readonly string[],
  basisFor: (item: LinkItem) => DesiredLink['basis'],
  classifiedBy: DesiredLink['classifiedBy'],
  reviewStatus: DesiredLink['reviewStatus'],
  noteFor: (item: LinkItem) => string,
): number {
  let skipped = 0;
  for (const item of section.items) {
    if (item.kind === 'AUTHOR_TEXT') continue;
    if (skipKabairFaslAyah(section, item.kind)) {
      skipped += 1;
      continue;
    }
    if (!item.quoteId) {
      skipped += 1;
      continue;
    }
    const basis = basisFor(item);
    for (const slug of slugs) {
      const topic = topicOf(topics, slug);
      out.push({
        side: topic.side,
        slug,
        quoteId: item.quoteId,
        basis,
        classifiedBy,
        reviewStatus,
        note: noteFor(item),
        relevanceScore: item.score,
        sectionId: section.id,
        sectionOrder: section.order,
        itemOrder: item.order,
        priority: linkPriority(basis),
      });
    }
  }
  return skipped;
}

export function buildLinks(
  topics: ReadonlyMap<string, Topic>,
  sections: readonly ReadySection[],
  content: readonly ContentRow[],
  strong: ReadonlyMap<string, readonly StrongHit[]>,
  sahihayn: ReadonlyMap<string, string>,
  sahihaynMap: readonly SahihaynMapRow[] = [],
): LinkBuild {
  const byId = new Map(sections.map((section) => [section.id, section]));
  const direct: DesiredLink[] = [];
  let skippedItems = 0;
  const proposals: ProposalRow[] = [];
  const mappedTopics = new Map(sahihaynMap.map((row) => [row.id, row.topics]));

  for (const section of sections) {
    if (section.anchorSlugs.length > 0) {
      const munajjid = section.book === 'munajjid' ? munajjidNote(section.page) : null;
      skippedItems += pushItemLinks(
        direct,
        section,
        topics,
        section.anchorSlugs,
        (item) => (munajjid ? 'AUTHOR_CITATION' : item.kind === 'AYAH' ? 'CHAPTER_AYAH' : 'CHAPTER'),
        'BOOK',
        'ACCEPTED',
        (item) => {
          if (munajjid) return munajjid;
          return item.kind === 'AYAH' ? ayahNote(section) : chapterNote(section, topics, section.anchorSlugs);
        },
      );
    }
    const reviewed = mappedTopics.get(section.id) ?? [];
    const reviewedSet = new Set(reviewed);
    if (section.keywordSlugs.length > 0) {
      const remaining = section.keywordSlugs.filter((slug) => !reviewedSet.has(slug));
      if (remaining.length > 0) {
        proposals.push({
          sectionId: section.id,
          title: section.titleAr,
          slugs: remaining.join(','),
          side: keywordSide(section.titleAr),
          items: section.ayah + section.hadith + section.author,
        });
        skippedItems += pushItemLinks(
          direct,
          section,
          topics,
          remaining,
          () => 'KEYWORD_PROPOSAL',
          'AI',
          'NOT_REVIEWED',
          () => keywordNote(section),
        );
      }
    }
  }

  for (const row of sahihaynMap) {
    const section = byId.get(row.id);
    if (!section) throw new Error(`sahihayn-map section ${row.id} is not in the database`);
    if (section.book !== row.book) {
      throw new Error(`sahihayn-map ${row.id} book is ${section.book}, expected ${row.book}`);
    }
    for (const item of section.items) {
      if (item.kind !== 'HADITH') continue;
      if (!item.quoteId) {
        skippedItems += 1;
        continue;
      }
      for (const slug of row.topics) {
        const topic = topicOf(topics, slug);
        direct.push({
          side: topic.side,
          slug,
          quoteId: item.quoteId,
          basis: 'CHAPTER',
          classifiedBy: 'REVIEWER',
          reviewStatus: 'ACCEPTED',
          note: chapterNote(section, topics, row.topics),
          relevanceScore: item.score,
          sectionId: section.id,
          sectionOrder: section.order,
          itemOrder: item.order,
          priority: linkPriority('CHAPTER'),
        });
      }
    }
  }

  for (const row of content) {
    if (row.decision !== 'TOPICS') continue;
    const section = byId.get(row.sectionId);
    if (!section) throw new Error(`content-map section ${row.sectionId} is not in the database`);
    if (row.topics.length === 0) throw new Error(`TOPICS row ${row.sectionId} has no slug`);
    skippedItems += pushItemLinks(direct, section, topics, row.topics, () => 'REVIEWER_SECTION', 'REVIEWER', 'ACCEPTED', () => reviewerNote(section));
  }

  for (const row of content) {
    if (row.decision !== 'ITEM') continue;
    const section = byId.get(row.sectionId);
    if (!section) throw new Error(`content-map section ${row.sectionId} is not in the database`);
    for (const item of section.items) {
      if (item.kind === 'AUTHOR_TEXT' || !item.quoteId) continue;
      const decision = ITEM_DECISIONS[item.quoteId];
      if (!decision || decision.confidence !== 'high' || decision.slugs.length === 0) continue;
      for (const slug of decision.slugs) {
        const topic = topicOf(topics, slug);
        direct.push({
          side: topic.side,
          slug,
          quoteId: item.quoteId,
          basis: 'AI_ITEM',
          classifiedBy: 'AI',
          reviewStatus: 'ACCEPTED',
          note: aiNote(),
          relevanceScore: item.score,
          sectionId: section.id,
          sectionOrder: section.order,
          itemOrder: item.order,
          priority: linkPriority('AI_ITEM'),
        });
      }
    }
  }

  const collapsed = collapse(direct);
  const propagated: DesiredLink[] = [];
  for (const link of collapsed) {
    if (link.reviewStatus !== 'ACCEPTED') continue;
    if (link.basis !== 'CHAPTER' && link.basis !== 'CHAPTER_AYAH' && link.basis !== 'AUTHOR_CITATION' && link.basis !== 'REVIEWER_SECTION') continue;
    const section = byId.get(link.sectionId);
    if (!section) continue;
    for (const hit of strong.get(link.quoteId) ?? []) {
      const target = sahihayn.get(`${hit.book}:${hit.number}`);
      if (!target || target === link.quoteId) continue;
      const topic = topicOf(topics, link.slug);
      propagated.push({
        side: topic.side,
        slug: link.slug,
        quoteId: target,
        basis: 'TAKHRIJ',
        classifiedBy: link.classifiedBy === 'REVIEWER' ? 'REVIEWER' : 'BOOK',
        reviewStatus: 'ACCEPTED',
        note: takhrijNote(hit.book, hit.number, section),
        relevanceScore: 80,
        sectionId: section.id,
        sectionOrder: section.order,
        itemOrder: link.itemOrder,
        priority: link.classifiedBy === 'REVIEWER' ? 21 : 20,
      });
    }
  }

  return { links: collapse([...collapsed, ...propagated]), proposals, skippedItems };
}
