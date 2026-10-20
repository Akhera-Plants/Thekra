/**
 * Structure parser for Ibn Abi al-Dunya OpenITI editions.
 *
 * Two numbering styles appear across the corpus:
 * - `### N -` headings (Shamela / JK mARkdown used by Zuhd, DhammGhiba, …)
 * - `# N -` paragraph lines (Samt, Sabr, …) which readBlocks emits as paragraphs
 *
 * Both become HADITH items. باب / كتاب headings open sections. Everything else
 * under a section is AUTHOR_TEXT (or AYAH when a verse citation is detected).
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

function rankOf(level: BookLevel): number {
  if (level === 'KITAB') return 1;
  if (level === 'BAB') return 3;
  if (level === 'FASL') return 5;
  return 6;
}

function levelWord(word: string): BookLevel | null {
  if (word === 'كتاب') return 'KITAB';
  if (word === 'باب') return 'BAB';
  if (word === 'فصل') return 'FASL';
  return null;
}

function numberedTitle(text: string): { number: string | null; title: string } {
  const wrapped = /^\((\d+)\)\s*-\s*(.+)$/.exec(text);
  if (wrapped?.[1] && wrapped[2]) return { number: wrapped[1], title: wrapped[2].trim() };
  const plain = /^(\d+)\s*-\s*(.+)$/.exec(text);
  if (plain?.[1] && plain[2]) return { number: plain[1], title: plain[2].trim() };
  return { number: null, title: text };
}

/** `# 1 -` or `1 -` or `1 - text…` */
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

function isSectionHeading(text: string): { level: BookLevel; number: string | null; title: string } | null {
  if (!text || text.startsWith('[ص:') || text.startsWith('[ص :')) return null;
  if (/^\[[^\]]+\]$/.test(text)) return null;
  // Bare narration number on a ### heading — not a section (handled as HADITH).
  if (/^(\d+)\s*-\s*$/.test(text.trim())) return null;

  const split = numberedTitle(text);
  const word = /^(كتاب|باب|فصل)(?:\s|:|$)/.exec(split.title);
  if (word) {
    const level = levelWord(word[1] ?? '');
    if (level) return { level, number: split.number, title: split.title };
  }
  if (arabicLetters(text) < 4) return null;
  if (/^PARATEXT|PageV/i.test(text)) return null;
  return { level: 'OTHER', number: null, title: text };
}

export function parseDunyaBook(source: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const stack: number[] = [];
  const current = slot<ParsedSection | null>(null);
  const hadith = slot<ParsedItem | null>(null);

  const open = (level: BookLevel, number: string | null, title: string, block: OpenitiBlock): void => {
    const section: ParsedSection = {
      level,
      number,
      titleAr: title,
      line: block.line,
      ...place(block.volume, block.page),
      parentIndex: null,
      rank: rankOf(level),
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
    for (const cite of extractCitations(title)) section.items.push(ayahItem(block.line, cite));
  };

  const ensure = (block: OpenitiBlock): ParsedSection => {
    if (current.v) return current.v;
    open('OTHER', null, 'صدر الكتاب', block);
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
      if (narration && (!narration.rest || arabicLetters(narration.rest) < 8 || /^(?:حدث|أخبر|أنا|ثنا)/.test(narration.rest))) {
        // `### 12 -` or `### 12 - حدثنا…`
        startHadith(block, narration.number, narration.rest);
        continue;
      }
      const heading = isSectionHeading(block.text);
      if (!heading) continue;
      open(heading.level, heading.number, heading.title, block);
      continue;
    }

    const narration = narrationStart(block.text);
    if (narration) {
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
