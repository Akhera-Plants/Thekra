/**
 * Structure parser for al-Adhkar (0676Nawawi.Adhkar.Shamela0001956-ara1).
 *
 * Narrations sit on `### | N - ` headings (DhammGhiba style) whose text
 * follows in `# ` / `~~` paragraphs; one narration (694) sits on a `# N - …`
 * paragraph line. كتاب / باب / فصل headings open sections; this edition wraps
 * many of them in `(…)` or `[فصل]`, so wrappers are stripped before level
 * detection. Everything else under a section is AUTHOR_TEXT (or AYAH when a
 * verse citation is detected). Al-Nawawi's own grading remarks («رويناه في
 * صحيح البخاري», «إسناده صحيح») stay inside the narration/author text and are
 * never read as a grade source.
 */
import { readBlocks, type OpenitiBlock } from '../lib/openiti.js';
import { extractCitations, type VerseCitation } from '../structure/citations.js';
import type { BookLevel, ParsedItem, ParsedSection } from '../structure/parse.js';

function arabicLetters(text: string): number {
  return (text.match(/[\u0621-\u064A]/g) ?? []).length;
}

function slot<T>(value: T): { v: T } {
  return { v: value };
}

function place(volume: number | null, page: number | null): { volume: string | null; page: string | null } {
  return {
    volume: volume == null ? null : String(volume),
    page: page == null ? null : String(page),
  };
}

function levelWord(word: string): BookLevel | null {
  if (word === 'كتاب') return 'KITAB';
  if (word === 'باب') return 'BAB';
  if (word === 'فصل') return 'FASL';
  return null;
}

/**
 * `(باب …)` → `باب …`, `[فصل] في …` → `فصل في …`, trailing `:` / `،` dropped.
 */
export function normalizeHeadingTitle(text: string): string {
  let title = text.trim();
  const wrapped = /^\(([^()]+)\)\s*:?\s*$/.exec(title);
  if (wrapped?.[1]) title = wrapped[1].trim();
  title = title.replace(/^\[(كتاب|باب|فصل)\]\s*:?\s*/, '$1 ');
  return title.replace(/[:،\s]+$/, '').trim();
}

/** `36 - ` or `694 - وروينا…` (milestone tokens are already stripped). */
function narrationStart(text: string): { number: number; rest: string } | null {
  const match = /^(\d+)\s*-\s*(.*)$/.exec(text.trim());
  if (!match?.[1]) return null;
  return { number: Number(match[1]), rest: (match[2] ?? '').trim() };
}

function ayahItem(line: number, cite: VerseCitation): ParsedItem {
  return {
    kind: 'AYAH',
    line,
    hadithNumber: null,
    text: null,
    ayahFrom: cite.from,
    ayahTo: cite.to,
  };
}

interface Heading {
  level: BookLevel;
  title: string;
  /** Lower ranks contain higher ranks (كتاب 1, أبواب 1, باب 3, فصل 5, other 6). */
  rank: number;
}

function isSectionHeading(text: string): Heading | null {
  if (!text || text.startsWith('[ص:') || text.startsWith('[ص :')) return null;
  if (/^\[[^\]]+\]$/.test(text)) return null;
  const title = normalizeHeadingTitle(text);
  if (!title) return null;

  const word = /^(كتاب|باب|فصل)(?:\s|:|$)/.exec(title);
  if (word) {
    const level = levelWord(word[1] ?? '');
    if (level === 'KITAB') return { level, title, rank: 1 };
    if (level === 'BAB') return { level, title, rank: 3 };
    if (level === 'FASL') return { level, title, rank: 5 };
  }
  // «أبواب …» groups babs the way a kitab does.
  if (/^أبواب(?:\s|$)/.test(title)) return { level: 'OTHER', title, rank: 1 };
  if (arabicLetters(title) < 4) return null;
  if (/^PARATEXT|PageV/i.test(title)) return null;
  return { level: 'OTHER', title, rank: 6 };
}

export function parseAdhkar(source: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const stack: number[] = [];
  const current = slot<ParsedSection | null>(null);
  const hadith = slot<ParsedItem | null>(null);

  const open = (heading: Heading, block: OpenitiBlock): void => {
    const section: ParsedSection = {
      level: heading.level,
      number: null,
      titleAr: heading.title,
      line: block.line,
      ...place(block.volume, block.page),
      parentIndex: null,
      rank: heading.rank,
      items: [],
    };
    while (stack.length > 0 && (sections[stack[stack.length - 1]!]?.rank ?? 0) >= section.rank) {
      stack.pop();
    }
    section.parentIndex = stack.at(-1) ?? null;
    sections.push(section);
    stack.push(sections.length - 1);
    current.v = section;
    hadith.v = null;
    for (const cite of extractCitations(heading.title)) section.items.push(ayahItem(block.line, cite));
  };

  const ensure = (block: OpenitiBlock): ParsedSection => {
    if (current.v) return current.v;
    open({ level: 'OTHER', title: 'صدر الكتاب', rank: 6 }, block);
    return current.v!;
  };

  const startHadith = (block: OpenitiBlock, number: number, rest: string): void => {
    const section = ensure(block);
    hadith.v = {
      kind: 'HADITH',
      line: block.line,
      hadithNumber: number,
      text: rest || '',
      ayahFrom: null,
      ayahTo: null,
    };
    section.items.push(hadith.v);
    for (const cite of extractCitations(rest)) section.items.push(ayahItem(block.line, cite));
  };

  for (const block of readBlocks(source)) {
    if (block.kind === 'heading') {
      const narration = narrationStart(block.text);
      if (
        narration &&
        (!narration.rest || arabicLetters(narration.rest) < 8 || /^(?:و?روينا|حدث|أخبر|أنا|ثنا)/.test(narration.rest))
      ) {
        // `### | 36 - ` (text follows in the next paragraphs).
        startHadith(block, narration.number, narration.rest);
        continue;
      }
      const heading = isSectionHeading(block.text);
      if (!heading) continue;
      open(heading, block);
      continue;
    }

    const narration = narrationStart(block.text);
    if (narration) {
      // `# 694 - روينا…` — the one paragraph-numbered narration.
      startHadith(block, narration.number, narration.rest);
      continue;
    }

    if (!current.v && arabicLetters(block.text) < 8) continue;
    const section = ensure(block);
    const cites = extractCitations(block.text);

    if (hadith.v) {
      hadith.v.text = hadith.v.text ? `${hadith.v.text}\n${block.text}` : block.text;
      for (const cite of cites) section.items.push(ayahItem(block.line, cite));
      continue;
    }

    if (arabicLetters(block.text) >= 8) {
      section.items.push({
        kind: 'AUTHOR_TEXT',
        line: block.line,
        hadithNumber: null,
        text: block.text,
        ayahFrom: null,
        ayahTo: null,
      });
    }
    for (const cite of cites) section.items.push(ayahItem(block.line, cite));
  }

  return sections;
}
