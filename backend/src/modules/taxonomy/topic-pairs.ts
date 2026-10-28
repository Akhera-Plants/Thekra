import { readTaxonomyFile } from './taxonomy-files.js';

export interface ResolvedPair {
  avoid: string;
  do: string;
  /** Arabic page title (pair.ar, else the deed's Arabic name). */
  titleAr: string;
  /** English page title (always the deed's English name). */
  titleEn: string;
}

export type TopicSide = 'AVOID' | 'DO';

interface TopicRow {
  slug: string;
  ar: string;
  en: string;
  side: TopicSide | null;
}

let cached: {
  bySlug: Map<string, ResolvedPair>;
  pairs: ResolvedPair[];
  topics: Map<string, TopicRow>;
} | null = null;

function field(inner: string, key: string): string | null {
  const match = new RegExp(`(?:^|,)\\s*${key}\\s*:\\s*([^,\\]}]+)`).exec(inner);
  if (!match?.[1]) return null;
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function parseTopics(text: string): Map<string, TopicRow> {
  const topics = new Map<string, TopicRow>();
  let section: 'topics' | 'pairs' | null = null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('topics:')) {
      section = 'topics';
      continue;
    }
    if (trimmed.startsWith('pairs:')) {
      section = 'pairs';
      continue;
    }
    if (trimmed.startsWith('domains:') || trimmed.startsWith('akhlaq:')) {
      section = null;
      continue;
    }
    if (!trimmed.startsWith('- {') || section !== 'topics') continue;
    const inner = trimmed.slice(trimmed.indexOf('{') + 1, trimmed.lastIndexOf('}'));
    const slug = field(inner, 'slug');
    const ar = field(inner, 'ar');
    const en = field(inner, 'en');
    const side = field(inner, 'side');
    if (slug && ar && en) topics.set(slug, { slug, ar, en, side: side === 'AVOID' || side === 'DO' ? side : null });
  }
  return topics;
}

function parsePairs(text: string, topics: Map<string, TopicRow>): ResolvedPair[] {
  const pairs: ResolvedPair[] = [];
  let inPairs = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('pairs:')) {
      inPairs = true;
      continue;
    }
    if (!inPairs) continue;
    if (!trimmed.startsWith('- {')) continue;
    const inner = trimmed.slice(trimmed.indexOf('{') + 1, trimmed.lastIndexOf('}'));
    const avoid = field(inner, 'avoid');
    const deed = field(inner, 'do');
    if (!avoid || !deed) throw new Error(`Bad pair line: ${trimmed.slice(0, 80)}`);
    const topic = topics.get(deed);
    if (!topic) throw new Error(`Pair do ${deed} missing from taxonomy`);
    pairs.push({
      avoid,
      do: deed,
      titleAr: field(inner, 'ar') ?? topic.ar,
      titleEn: topic.en,
    });
  }
  return pairs;
}

function load(): NonNullable<typeof cached> {
  if (cached) return cached;
  const text = readTaxonomyFile('taxonomy.yaml');
  const topics = parseTopics(text);
  const pairs = parsePairs(text, topics);
  const bySlug = new Map<string, ResolvedPair>();
  for (const pair of pairs) {
    bySlug.set(pair.avoid, pair);
    bySlug.set(pair.do, pair);
  }
  cached = { bySlug, pairs, topics };
  return cached;
}

/** Drop the module cache (tests / after re-import). */
export function resetTopicPairsCache(): void {
  cached = null;
}

export function pairForSlug(slug: string): ResolvedPair | null {
  return load().bySlug.get(slug) ?? null;
}

export function allTopicPairs(): readonly ResolvedPair[] {
  return load().pairs;
}

export function isPairedSlug(slug: string): boolean {
  return load().bySlug.has(slug);
}

/** `side:` of a taxonomy.yaml topic (AVOID = sin, DO = good deed), or null when the slug is not a topic. */
export function topicSide(slug: string): TopicSide | null {
  return load().topics.get(slug)?.side ?? null;
}
