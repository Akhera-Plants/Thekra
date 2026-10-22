import { readTaxonomyFile, taxonomyFilePath } from './taxonomy-files.js';

/**
 * Topic themes (prisma/taxonomy/topic-themes.yaml): short reviewer labels
 * derived from the scholars' chapter titles of one topic. The taxonomy import
 * stores the matching keys on each link (SinQuote/GoodDeedQuote.themeKeys);
 * the reader endpoints filter by them and list them with counts.
 *
 * Plain TypeScript only: the import scripts load this file with Node's type
 * stripping.
 */
export interface TopicTheme {
  /** Topic slug that owns the theme (sin or good deed). */
  topic: string;
  /** URL key, unique across the whole file. */
  key: string;
  ar: string;
  en: string;
  /** Normalised substrings of the link's chapter title. */
  match: string[];
  /** Position in the file (display order). */
  order: number;
}

const THEME_KEYS = new Set(['topic', 'key', 'ar', 'en', 'match']);
export const THEME_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_THEMES_PER_TOPIC = 8;

/** Arabic folding for theme matching and search (tashkeel, hamza seats, ta marbuta, punctuation). */
export function normTheme(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/[()[\]{}«»"'.,،؛;:!?؟\-–—_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFlow(inner: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let depth = 0;
  let key: string | null = null;
  let valueStart = 0;
  const begin = (at: number): number => {
    const match = /^\s*([A-Za-z]+)\s*:/.exec(inner.slice(at));
    if (!match?.[1] || !THEME_KEYS.has(match[1])) {
      throw new Error(`topic-themes: unknown field near "${inner.slice(at, at + 40)}"`);
    }
    key = match[1];
    return at + match[0].length;
  };
  valueStart = begin(0);
  for (let index = valueStart; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === '[') depth += 1;
    else if (char === ']') depth -= 1;
    else if (char === ',' && depth === 0) {
      const next = /^\s*([A-Za-z]+)\s*:/.exec(inner.slice(index + 1));
      if (next?.[1] && THEME_KEYS.has(next[1]) && key) {
        fields[key] = inner.slice(valueStart, index).trim();
        valueStart = begin(index + 1);
        index = valueStart - 1;
      }
    }
  }
  if (key) fields[key] = inner.slice(valueStart).trim();
  return fields;
}

function parseList(value: string | undefined): string[] {
  const match = /^\[(.*)\]$/.exec(value ?? '');
  if (!match) throw new Error(`topic-themes: expected a list, got ${value ?? 'nothing'}`);
  return (match[1] ?? '')
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter((part) => part.length > 0);
}

function text(fields: Record<string, string>, key: string, line: number): string {
  const value = (fields[key] ?? '').replace(/^["']|["']$/g, '').trim();
  if (!value) throw new Error(`topic-themes line ${line}: missing ${key}`);
  return value;
}

/** Parses the reviewer file. Structural checks only; topic slugs are checked by the importer. */
export function parseTopicThemes(source: string): TopicTheme[] {
  const themes: TopicTheme[] = [];
  const lines = source.split('\n');
  lines.forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('- {')) return;
    const inner = trimmed.slice(trimmed.indexOf('{') + 1, trimmed.lastIndexOf('}'));
    const fields = parseFlow(inner);
    const line = index + 1;
    const match = parseList(fields['match']).map(normTheme).filter((part) => part.length > 0);
    if (match.length === 0) throw new Error(`topic-themes line ${line}: match is empty`);
    themes.push({
      topic: text(fields, 'topic', line),
      key: text(fields, 'key', line),
      ar: text(fields, 'ar', line),
      en: text(fields, 'en', line),
      match,
      order: themes.length,
    });
  });
  const keys = new Set<string>();
  const perTopic = new Map<string, number>();
  for (const theme of themes) {
    if (!THEME_KEY_PATTERN.test(theme.key)) throw new Error(`topic-themes: bad key ${theme.key}`);
    if (keys.has(theme.key)) throw new Error(`topic-themes: duplicate key ${theme.key}`);
    keys.add(theme.key);
    const count = (perTopic.get(theme.topic) ?? 0) + 1;
    if (count > MAX_THEMES_PER_TOPIC) throw new Error(`topic-themes: ${theme.topic} has more than ${MAX_THEMES_PER_TOPIC} themes`);
    perTopic.set(theme.topic, count);
  }
  return themes;
}

/** Chapter title cited by a link note («من باب: …», «أورده … في باب: …», «… ورد في باب: … من …»). */
export function chapterTitleFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  // Greedy: the book follows the last «من».
  const takhrij = /ورد في باب:\s*(.+)\s+من\s+[^—]+$/.exec(note);
  if (takhrij?.[1]) return takhrij[1];
  const chapter = /في باب:\s*(.+?)\s+—\s+[^—]+$/.exec(note) ?? /^من باب:\s*(.+?)\s+—\s+[^—]+$/.exec(note)
    ?? /حسب موضوع الباب:\s*(.+?)\s+—\s+[^—]+$/.exec(note) ?? /عنوان الباب:\s*(.+?)\s+—\s+[^—]+$/.exec(note);
  return chapter?.[1] ?? null;
}

/** A «فصل» or a bare number says nothing about the topic; the parent heading does. */
export function isGenericTitle(title: string): boolean {
  const folded = normTheme(title);
  return folded.length < 6 || /^(فصل|باب|فصل في|فصل منه)$/.test(folded) || /^فصل \d*$/.test(folded);
}

/**
 * The text a theme pattern is matched against: the link's own chapter
 * heading (parents too when it is a bare «فصل»), else the title in its note.
 * Book names are left out so a pattern cannot match a whole book.
 */
export function themeHaystack(input: {
  note: string | null;
  sectionTitle: string | null;
  parentTitles: readonly string[];
}): string {
  const parts: string[] = [];
  if (input.sectionTitle) {
    parts.push(input.sectionTitle);
    if (isGenericTitle(input.sectionTitle)) parts.push(...input.parentTitles.slice(0, 1));
  }
  const fromNote = chapterTitleFromNote(input.note);
  if (fromNote && !(input.sectionTitle && normTheme(fromNote) === normTheme(input.sectionTitle))) {
    parts.push(fromNote);
    if (!input.sectionTitle && isGenericTitle(fromNote)) parts.push(...input.parentTitles.slice(0, 1));
  }
  return ` ${normTheme(parts.join(' | '))} `;
}

/**
 * Keys (file order) whose pattern occurs in the haystack as whole words, so
 * «الصدق» does not match «الصدقه». The haystack is space-padded by themeHaystack.
 */
export function matchThemeKeys(themes: readonly TopicTheme[], haystack: string): string[] {
  const padded = ` ${haystack.trim()} `;
  return themes.filter((theme) => theme.match.some((pattern) => padded.includes(` ${pattern} `))).map((theme) => theme.key);
}

let cached: { themes: TopicTheme[]; byTopic: Map<string, TopicTheme[]>; byKey: Map<string, TopicTheme> } | null = null;

/** On-disk path for the import scripts; the API reads the file through readTaxonomyFile. */
export function topicThemesPath(): string {
  return taxonomyFilePath('topic-themes.yaml');
}

function load() {
  if (cached) return cached;
  let source = '';
  try {
    source = readTaxonomyFile('topic-themes.yaml');
  } catch {
    source = '';
  }
  const themes = parseTopicThemes(source);
  const byTopic = new Map<string, TopicTheme[]>();
  for (const theme of themes) byTopic.set(theme.topic, [...(byTopic.get(theme.topic) ?? []), theme]);
  cached = { themes, byTopic, byKey: new Map(themes.map((theme) => [theme.key, theme])) };
  return cached;
}

export function resetTopicThemesCache(): void {
  cached = null;
}

export function allTopicThemes(): readonly TopicTheme[] {
  return load().themes;
}

export function themesForTopics(slugs: readonly string[]): TopicTheme[] {
  const index = load().byTopic;
  return slugs.flatMap((slug) => index.get(slug) ?? []);
}

export function themeByKey(key: string): TopicTheme | null {
  return load().byKey.get(key) ?? null;
}
