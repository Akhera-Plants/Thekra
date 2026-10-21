import { norm, containsPhrase } from './norm.js';
import { ordinalInTitle } from './ordinal.js';
import type { Topic, TopicSide } from './yaml.js';

export type AnchorBook = 'riyad' | 'targhib' | 'zuhd' | 'minhaj' | 'kabair' | 'munajjid';
export type KeywordBook = 'adab' | 'bukhari' | 'muslim';
export type BookKey = AnchorBook | KeywordBook | 'shuab';

export interface MatchSection {
  id: string;
  book: BookKey;
  level: string;
  number: string | null;
  titleAr: string;
  parentPath: string;
  ayah: number;
  hadith: number;
  author: number;
  kabiraNumber: number | null;
  order: number;
}

export interface Coverage {
  targhib: { matched: number; eligible: number };
  zuhd: { matched: number; eligible: number };
  minhaj: { matched: number; eligible: number };
  unmapped: number;
  unmappedIds: string[];
  items: Record<string, number>;
}

const ELIGIBLE: Record<'riyad' | 'targhib' | 'zuhd' | 'minhaj', ReadonlySet<string>> = {
  riyad: new Set(['BAB']),
  targhib: new Set(['TARGHIB', 'TARHIB']),
  zuhd: new Set(['BAB']),
  minhaj: new Set(['FASL', 'BAB']),
};

const ITEM_SLUGS = [
  'ghibah', 'kadhib', 'khiyana', 'salah', 'salat-fi-jamaah', 'siyam', 'dhikr', 'dhikr-akhira', 'adha-muslimin',
] as const;

export const EXPECTED_COVERAGE = {
  targhib: { matched: 338, eligible: 512 },
  zuhd: { matched: 59, eligible: 85 },
  minhaj: { matched: 113, eligible: 140 },
  unmapped: 384,
  items: {
    ghibah: 51,
    kadhib: 18,
    khiyana: 5,
    salah: 125,
    'salat-fi-jamaah': 168,
    // Was 108: that count wrongly included «باب تحريم الغدر» (2 ayahs + 4 hadiths),
    // which shares the printed number 227 with «باب فضل صوم يوم عرفة».
    siyam: 102,
    dhikr: 964,
    'dhikr-akhira': 215,
    'adha-muslimin': 22,
  },
} as const;

export function withinTwoPercent(actual: number, expected: number): boolean {
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) / expected <= 0.02;
}

export function withKabiraNumbers(sections: readonly MatchSection[]): MatchSection[] {
  const titled = new Map<string, number>();
  const stamped = sections.map((section) => {
    if (section.book !== 'kabair' || section.level !== 'KABIRA') return { ...section };
    const number = ordinalInTitle(section.titleAr);
    if (number !== null) titled.set(section.titleAr, number);
    return { ...section, kabiraNumber: number };
  });
  return stamped.map((section) => {
    if (section.book !== 'kabair' || section.level !== 'FASL' || section.kabiraNumber !== null) return section;
    const parts = section.parentPath.split(' › ');
    for (const part of parts) {
      const number = titled.get(part);
      if (number !== undefined) return { ...section, kabiraNumber: number };
    }
    return section;
  });
}

function unique(slugs: readonly string[]): string[] {
  return [...new Set(slugs)];
}

/** Topic slugs reached through numeric riyad anchors, keyed by section id. */
export type RiyadNumberIndex = ReadonlyMap<string, readonly string[]>;

export interface RiyadNumberResolution {
  index: RiyadNumberIndex;
  warnings: string[];
}

function printedNumber(section: MatchSection): number | null {
  return section.number !== null && /^\d+$/.test(section.number) ? Number(section.number) : null;
}

/**
 * Resolve numeric riyad anchors to BAB sections. The printed numbering repeats
 * (227 is both «فضل صوم يوم عرفة» in كتاب الفضائل and «تحريم الغدر» in كتاب الأمور
 * المنهي عنها), so a repeated number only matches the candidate whose kitab
 * (parentPath) is the kitab of the topic's unambiguous numeric anchors. When
 * that leaves anything but one candidate, the anchor matches nothing and a
 * warning names the topic, the number and the candidates.
 */
export function resolveRiyadNumbers(topics: readonly Topic[], sections: readonly MatchSection[]): RiyadNumberResolution {
  const byNumber = new Map<number, MatchSection[]>();
  for (const section of sections) {
    if (section.book !== 'riyad' || !ELIGIBLE.riyad.has(section.level)) continue;
    const number = printedNumber(section);
    if (number === null) continue;
    const list = byNumber.get(number) ?? [];
    list.push(section);
    byNumber.set(number, list);
  }
  const index = new Map<string, string[]>();
  const warnings: string[] = [];
  const add = (section: MatchSection, slug: string): void => {
    const list = index.get(section.id) ?? [];
    if (!list.includes(slug)) list.push(slug);
    index.set(section.id, list);
  };
  for (const topic of topics) {
    const resolved: MatchSection[] = [];
    const repeated: { number: number; candidates: MatchSection[] }[] = [];
    for (const number of topic.riyadNumbers) {
      const candidates = byNumber.get(number) ?? [];
      if (candidates.length === 1) resolved.push(candidates[0] as MatchSection);
      else if (candidates.length > 1) repeated.push({ number, candidates });
    }
    const kitabs = new Set(resolved.map((section) => section.parentPath));
    for (const { number, candidates } of repeated) {
      const narrowed = candidates.filter((section) => kitabs.has(section.parentPath));
      if (narrowed.length === 1) {
        resolved.push(narrowed[0] as MatchSection);
        continue;
      }
      const titles = candidates.map((section) => `«${section.titleAr}» (${section.parentPath})`).join('، ');
      warnings.push(`riyad: topic ${topic.slug} anchor ${number} is ambiguous, matched none; candidates: ${titles}`);
    }
    for (const section of resolved) add(section, topic.slug);
  }
  return { index, warnings };
}

function riyadSlugs(section: MatchSection, topics: readonly Topic[], numbers: RiyadNumberIndex): string[] {
  const numbered = numbers.get(section.id) ?? [];
  const slugs: string[] = [];
  for (const topic of topics) {
    if (numbered.includes(topic.slug)) slugs.push(topic.slug);
    if (topic.riyadPhrases.some((phrase) => containsPhrase(section.titleAr, phrase))) slugs.push(topic.slug);
  }
  return unique(slugs);
}

function targhibAllows(topic: Topic, title: string): boolean {
  if (!topic.sideCheck) return true;
  const text = norm(title);
  return text.includes(norm(topic.side === 'DO' ? 'ترغيب' : 'ترهيب'));
}

function phraseSlugs(
  section: MatchSection,
  topics: readonly Topic[],
  field: 'targhib' | 'zuhd' | 'minhaj' | 'munajjid',
): string[] {
  const haystack = field === 'minhaj' ? `${section.titleAr} ${section.parentPath}` : section.titleAr;
  const slugs: string[] = [];
  for (const topic of topics) {
    const phrases = topic[field];
    if (!phrases.some((phrase) => containsPhrase(haystack, phrase))) continue;
    if (field === 'targhib' && !targhibAllows(topic, section.titleAr)) continue;
    slugs.push(topic.slug);
  }
  return unique(slugs);
}

function kabairSlugs(section: MatchSection, topics: readonly Topic[]): string[] {
  if (section.kabiraNumber === null) return [];
  return topics.filter((topic) => topic.kabair.includes(section.kabiraNumber as number)).map((topic) => topic.slug);
}

/** `riyadNumbers` comes from {@link resolveRiyadNumbers} over the same topics and all sections. */
export function matchSection(section: MatchSection, topics: readonly Topic[], riyadNumbers: RiyadNumberIndex): string[] {
  if (section.book === 'riyad' && ELIGIBLE.riyad.has(section.level)) return riyadSlugs(section, topics, riyadNumbers);
  if (section.book === 'targhib' && ELIGIBLE.targhib.has(section.level)) return phraseSlugs(section, topics, 'targhib');
  if (section.book === 'zuhd' && ELIGIBLE.zuhd.has(section.level)) return phraseSlugs(section, topics, 'zuhd');
  if (section.book === 'minhaj' && ELIGIBLE.minhaj.has(section.level)) return phraseSlugs(section, topics, 'minhaj');
  if (section.book === 'kabair' && (section.level === 'KABIRA' || section.level === 'FASL')) return kabairSlugs(section, topics);
  if (section.book === 'munajjid') return phraseSlugs(section, topics, 'munajjid');
  return [];
}

export function matchAnchors(topics: readonly Topic[], sections: readonly MatchSection[]): Map<string, string[]> {
  const matches = new Map<string, string[]>();
  const { index } = resolveRiyadNumbers(topics, sections);
  for (const section of sections) {
    const slugs = matchSection(section, topics, index);
    if (slugs.length > 0) matches.set(section.id, slugs);
  }
  return matches;
}

function eligible(section: MatchSection): boolean {
  if (section.book === 'riyad' || section.book === 'targhib' || section.book === 'zuhd' || section.book === 'minhaj') {
    return ELIGIBLE[section.book].has(section.level);
  }
  return false;
}

export function coverage(topics: readonly Topic[], sections: readonly MatchSection[]): Coverage {
  const matches = matchAnchors(topics, sections);
  const byBook = { riyad: { matched: 0, eligible: 0 }, targhib: { matched: 0, eligible: 0 }, zuhd: { matched: 0, eligible: 0 }, minhaj: { matched: 0, eligible: 0 } };
  const unmappedIds: string[] = [];
  for (const section of sections) {
    if (!eligible(section)) continue;
    const book = section.book as keyof typeof byBook;
    byBook[book].eligible += 1;
    if (matches.has(section.id)) byBook[book].matched += 1;
    else unmappedIds.push(section.id);
  }
  const items: Record<string, number> = {};
  for (const slug of ITEM_SLUGS) items[slug] = 0;
  for (const section of sections) {
    if (section.book === 'kabair' || section.book === 'munajjid') continue;
    const slugs = matches.get(section.id);
    if (!slugs) continue;
    // The published totals were counted before Targhib verse keys became AYAH
    // rows. Those ayahs are still linked; they are not part of this comparison.
    const count = section.book === 'targhib' ? section.hadith : section.ayah + section.hadith;
    for (const slug of slugs) {
      if (items[slug] !== undefined) items[slug] += count;
    }
  }
  return {
    targhib: byBook.targhib,
    zuhd: byBook.zuhd,
    minhaj: byBook.minhaj,
    unmapped: unmappedIds.length,
    unmappedIds,
    items,
  };
}

export function coverageDiff(actual: Coverage): string[] {
  const problems: string[] = [];
  for (const book of ['targhib', 'zuhd', 'minhaj'] as const) {
    const expected = EXPECTED_COVERAGE[book];
    const got = actual[book];
    if (!withinTwoPercent(got.matched, expected.matched) || got.eligible !== expected.eligible) {
      problems.push(`${book}: got ${got.matched}/${got.eligible}, expected ${expected.matched}/${expected.eligible}`);
    }
  }
  if (!withinTwoPercent(actual.unmapped, EXPECTED_COVERAGE.unmapped)) {
    problems.push(`unmapped: got ${actual.unmapped}, expected ${EXPECTED_COVERAGE.unmapped}`);
  }
  for (const [slug, expected] of Object.entries(EXPECTED_COVERAGE.items)) {
    const got = actual.items[slug] ?? 0;
    if (!withinTwoPercent(got, expected)) problems.push(`${slug}: got ${got} items, expected ${expected}`);
  }
  return problems;
}

const AVOID_VERBS = ['تحريم', 'النهي', 'الترهيب', 'ذم', 'كراهية'];
const DO_VERBS = ['فضل', 'الترغيب', 'استحباب', 'الحث', 'الأمر بـ'];

export function keywordSide(title: string): 'AVOID' | 'DO' | 'EITHER' {
  const text = norm(title);
  const avoid = AVOID_VERBS.some((verb) => text.includes(norm(verb)));
  const doing = DO_VERBS.some((verb) => text.includes(norm(verb)));
  if (avoid === doing) return 'EITHER';
  return avoid ? 'AVOID' : 'DO';
}

export function matchKeywords(section: MatchSection, topics: readonly Topic[]): string[] {
  if (section.book !== 'adab' && section.book !== 'bukhari' && section.book !== 'muslim') return [];
  if (section.level !== 'BAB') return [];
  const side = keywordSide(section.titleAr);
  const slugs: string[] = [];
  for (const topic of topics) {
    if (side !== 'EITHER' && topic.side !== side) continue;
    if (topic.kw.some((phrase) => containsPhrase(section.titleAr, phrase))) slugs.push(topic.slug);
  }
  return unique(slugs);
}

export function isMixed(slugs: readonly string[], topics: ReadonlyMap<string, Topic>): boolean {
  const sides = new Set<TopicSide>();
  for (const slug of slugs) {
    const topic = topics.get(slug);
    if (topic) sides.add(topic.side);
  }
  return sides.size > 1;
}
