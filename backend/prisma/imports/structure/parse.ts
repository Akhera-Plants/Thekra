/**
 * Mechanical book structure. A heading becomes a section. What the author
 * placed under it becomes items, in that order. Nothing is classified.
 */
import { normalizeArabic } from '../../../src/common/text/arabic-normalizer.js';
import { readBlocks, type OpenitiBlock } from '../lib/openiti.js';
import { parseTarghib } from '../waqfeya/parse.js';
import { extractCitations, type VerseCitation } from './citations.js';
import { splitKabairBlock } from './kabair.js';

export type BookLevel = 'KITAB' | 'BAB' | 'FASL' | 'TARGHIB' | 'TARHIB' | 'KABIRA' | 'BRANCH' | 'OTHER';
export type ItemKind = 'AYAH' | 'HADITH' | 'AUTHOR_TEXT';
export type OpenitiBook = 'riyad' | 'zuhd' | 'minhaj' | 'kabair' | 'adab' | 'shuab' | 'bukhari';

export interface ParsedItem {
  kind: ItemKind;
  line: number;
  hadithNumber: number | null;
  /** Narration text used to find the existing quote, or the author's paragraph. */
  text: string | null;
  ayahFrom: string | null;
  ayahTo: string | null;
  /** Set when the item must point at an existing quote and no new wording is stored. */
  quoteId?: string | null;
}

export interface ParsedSection {
  level: BookLevel;
  number: string | null;
  titleAr: string;
  line: number;
  volume: string | null;
  page: string | null;
  /** Index into the returned array. Null for a top-level heading. */
  parentIndex: number | null;
  /** Lower ranks contain higher ranks. Used only while the tree is open. */
  rank: number;
  items: ParsedItem[];
}

export interface BranchMark {
  line: number;
  number: string;
  title: string;
}

const HEADER_END = '#META#Header#End#';

/** Shamela marks a Bukhari kitab with `### $`, which readBlocks strips. */
function bukhariKitabLines(source: string): Set<number> {
  const lines = new Set<number>();
  source.split(/\r?\n/).forEach((line, index) => {
    if (/^###\s+\$+/.test(line)) lines.add(index + 1);
  });
  return lines;
}
const COMMENTARY = /^(?:وهذا|وهذه|ومعنى|اعلم|قوله|وفي الباب|قال النووي)/;
const PROPHET = /قال\s+(?:رسول الله|النبي)|صلى الله عليه وسلم|عن النبي/;

function arabicLetters(text: string): number {
  return (text.match(/[\u0621-\u064A]/g) ?? []).length;
}

/** A box so a closure can update the cursor without TypeScript freezing it as null. */
function slot<T>(value: T): { v: T } {
  return { v: value };
}

function place(volume: number | null, page: number | null): { volume: string | null; page: string | null } {
  return {
    volume: volume == null ? null : String(volume),
    page: page == null ? null : String(page),
  };
}

function rankOf(level: BookLevel, title: string): number {
  if (level === 'OTHER' && /^الربع(?:\s|$)/.test(title)) return 0;
  if (level === 'KITAB') return 1;
  if (level === 'BRANCH' || level === 'KABIRA') return 2;
  if (level === 'BAB') return 3;
  if (level === 'TARGHIB' || level === 'TARHIB') return 4;
  if (level === 'FASL') return 5;
  return 6;
}

interface SectionHeading {
  kind: 'section';
  level: BookLevel;
  number: string | null;
  title: string;
}

type Heading =
  | { kind: 'skip' }
  | { kind: 'hadith'; number: number }
  | SectionHeading;

function hadithNumber(text: string): number | null {
  const match = /^(\d+)\s*-\s*$/.exec(text);
  return match?.[1] ? Number(match[1]) : null;
}

function numberedTitle(text: string): { number: string | null; title: string } {
  const wrapped = /^\((\d+)\)\s*-\s*(.+)$/.exec(text);
  if (wrapped?.[1] && wrapped[2]) return { number: wrapped[1], title: wrapped[2].trim() };
  const plain = /^(\d+)\s*-\s*(.+)$/.exec(text);
  if (plain?.[1] && plain[2]) return { number: plain[1], title: plain[2].trim() };
  return { number: null, title: text };
}

function levelWord(word: string): BookLevel | null {
  if (word === 'كتاب') return 'KITAB';
  if (word === 'باب') return 'BAB';
  if (word === 'فصل') return 'FASL';
  return null;
}

function classify(book: OpenitiBook, text: string): Heading {
  if (!text || text.startsWith('[ص:') || text.startsWith('[ص :')) return { kind: 'skip' };
  if (/^\[[^\]]+\]$/.test(text)) return { kind: 'skip' };
  if (book === 'adab' && text.startsWith('[قال الشيخ الألباني]')) return { kind: 'skip' };

  const number = hadithNumber(text);
  if (number !== null && book !== 'minhaj') return { kind: 'hadith', number };

  if (book === 'kabair' && text.startsWith('الكبيرة ')) {
    const word = text.slice('الكبيرة '.length).split(/\s+/)[0] ?? null;
    return { kind: 'section', level: 'KABIRA', number: word, title: text };
  }

  const minhaj = /^(?:(\d+)\s+)?(كتاب|باب|فصل)(?:\s|:|$)(.*)$/.exec(text);
  if (minhaj && (book === 'minhaj' || book === 'shuab' || book === 'kabair')) {
    const level = levelWord(minhaj[2] ?? '');
    if (level) return { kind: 'section', level, number: minhaj[1] ?? null, title: text };
  }

  const split = numberedTitle(text);
  const word = /^(كتاب|باب|فصل)(?:\s|:|$)/.exec(split.title);
  if (word) {
    const level = levelWord(word[1] ?? '');
    if (level) return { kind: 'section', level, number: split.number, title: split.title };
  }

  if (book === 'kabair' && text === 'فصل') return { kind: 'section', level: 'FASL', number: null, title: text };
  if (arabicLetters(text) < 8) return { kind: 'skip' };
  return { kind: 'section', level: 'OTHER', number: null, title: text };
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

function isCommentary(text: string): boolean {
  return COMMENTARY.test(normalizeArabic(text).replace(/^[^\u0621-\u064A]+/, ''));
}

export function parseOpenitiBook(
  source: string,
  book: OpenitiBook,
  branches: readonly BranchMark[] = [],
): ParsedSection[] {
  const branchAt = new Map(branches.map((branch) => [branch.line, branch]));
  const kitabLines = book === 'bukhari' ? bukhariKitabLines(source) : new Set<number>();
  const sections: ParsedSection[] = [];
  const stack: number[] = [];
  const current = slot<ParsedSection | null>(null);
  const hadith = slot<ParsedItem | null>(null);
  let skip = false;
  let absorbBabTitle = false;

  const open = (heading: SectionHeading, block: OpenitiBlock): void => {
    const section: ParsedSection = {
      level: heading.level,
      number: heading.number,
      titleAr: heading.title,
      line: block.line,
      ...place(block.volume, block.page),
      parentIndex: null,
      rank: rankOf(heading.level, heading.title),
      items: [],
    };
    while (stack.length > 0 && sections[stack[stack.length - 1]!]?.rank !== undefined
      && (sections[stack[stack.length - 1]!]?.rank ?? 0) >= section.rank) {
      stack.pop();
    }
    section.parentIndex = stack.at(-1) ?? null;
    sections.push(section);
    stack.push(sections.length - 1);
    current.v = section;
    hadith.v = null;
    absorbBabTitle = book === 'adab' && heading.title === 'باب';
    for (const cite of extractCitations(heading.title)) section.items.push(ayahItem(block.line, cite));
  };

  const ensure = (block: OpenitiBlock): ParsedSection => {
    if (current.v) return current.v;
    open({ kind: 'section', level: 'OTHER', number: null, title: 'صدر الكتاب' }, block);
    return current.v!;
  };

  for (const block of readBlocks(source)) {
    if (block.kind === 'heading') {
      const branch = branchAt.get(block.line);
      if (branch) {
        skip = false;
        open({ kind: 'section', level: 'BRANCH', number: branch.number, title: branch.title }, block);
        continue;
      }
      if (kitabLines.has(block.line) || (book === 'bukhari' && block.text === 'بدء الوحي')) {
        skip = false;
        const split = block.text === 'بدء الوحي'
          ? { number: '1', title: 'بدء الوحي' }
          : numberedTitle(block.text);
        open({ kind: 'section', level: 'KITAB', number: split.number, title: split.title }, block);
        continue;
      }
      const heading = classify(book, block.text);
      if (book === 'bukhari' && heading.kind === 'section' && heading.level === 'OTHER') {
        heading.level = 'BAB';
      }
      if (heading.kind === 'skip') {
        skip = block.text.startsWith('[قال الشيخ الألباني]');
        continue;
      }
      skip = false;
      if (heading.kind === 'hadith') {
        const section = ensure(block);
        hadith.v = {
          kind: 'HADITH',
          line: block.line,
          hadithNumber: heading.number,
          text: '',
          ayahFrom: null,
          ayahTo: null,
        };
        section.items.push(hadith.v);
        continue;
      }
      open(heading, block);
      continue;
    }

    if (skip) continue;
    const branch = branchAt.get(block.line);
    if (branch) {
      open(
        { kind: 'section', level: 'BRANCH', number: branch.number, title: branch.title },
        block,
      );
      continue;
    }
    if (absorbBabTitle && current.v && arabicLetters(block.text) >= 2) {
      current.v.titleAr = `باب ${block.text}`;
      current.v.rank = rankOf('BAB', current.v.titleAr);
      absorbBabTitle = false;
      continue;
    }
    if (!current.v && arabicLetters(block.text) < 8) continue;
    const section = ensure(block);
    const cites = extractCitations(block.text);

    if (hadith.v && !isCommentary(block.text)) {
      hadith.v.text = hadith.v.text ? `${hadith.v.text}\n${block.text}` : block.text;
      for (const cite of cites) section.items.push(ayahItem(block.line, cite));
      continue;
    }
    hadith.v = null;

    if (book === 'kabair') {
      for (const piece of splitKabairBlock(block.text)) {
        if (piece.kind === 'BRACE') {
          section.items.push({
            kind: 'AYAH',
            line: block.line,
            hadithNumber: null,
            text: piece.text,
            ayahFrom: null,
            ayahTo: null,
          });
          continue;
        }
        section.items.push({
          kind: piece.kind,
          line: block.line,
          hadithNumber: null,
          text: piece.text,
          ayahFrom: null,
          ayahTo: null,
        });
      }
      for (const cite of cites) section.items.push(ayahItem(block.line, cite));
      continue;
    }

    const residue = block.text
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/قال الله تعالى|وقال تعالى|لقول الله تعالى|لقوله تعالى|قوله تعالى/g, ' ');
    const citationOnly = cites.length > 0 && arabicLetters(residue) < 25;
    const prophet = book === 'minhaj'
      && PROPHET.test(block.text)
      && arabicLetters(block.text) >= 40;
    const tarkNarration = book === 'zuhd'
      && section.titleAr.includes('ترك شيئا')
      && /^(?:أنا|حدثنا|أخبرنا|سمعت)\s/.test(block.text.trim());

    if (prophet || tarkNarration) {
      section.items.push({
        kind: 'HADITH',
        line: block.line,
        hadithNumber: null,
        text: block.text,
        ayahFrom: null,
        ayahTo: null,
      });
    } else if (!citationOnly && arabicLetters(block.text) >= 8) {
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

const MUSLIM_KITAB = /^#\s*\|\s*\d+\s*\(\s*(\d+)\s+كتاب\s*(.*)$/;
const MUSLIM_BAB = /^#\s*\|\s*\d+\s*\(\s*(\d+)\s+باب\s*(.*)$/;
const MUSLIM_HADITH = /^#\s+(\d+)\s+(.*)$/;

/** Sahih Muslim's JK file has no `###` headings. Kitab and bab sit on `# |` lines. */
export function parseMuslimBook(source: string): ParsedSection[] {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(HEADER_END)) + 1;
  const sections: ParsedSection[] = [];
  const stack: number[] = [];
  const current = slot<ParsedSection | null>(null);
  const hadith = slot<ParsedItem | null>(null);
  let extendingTitle = false;

  const open = (level: BookLevel, number: string, title: string, line: number): ParsedSection => {
    const section: ParsedSection = {
      level,
      number,
      titleAr: title.replace(/\s+/g, ' ').trim(),
      line,
      volume: null,
      page: null,
      parentIndex: null,
      rank: rankOf(level, title),
      items: [],
    };
    while (stack.length > 0 && (sections[stack[stack.length - 1]!]?.rank ?? 0) >= section.rank) stack.pop();
    section.parentIndex = stack.at(-1) ?? null;
    sections.push(section);
    stack.push(sections.length - 1);
    current.v = section;
    hadith.v = null;
    for (const cite of extractCitations(section.titleAr)) section.items.push(ayahItem(line, cite));
    return section;
  };

  for (let index = Math.max(start, 0); index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const line = index + 1;
    if (raw.startsWith('~~')) {
      const text = raw.slice(2).trim();
      if (extendingTitle && current.v) {
        current.v.titleAr = `${current.v.titleAr} ${text}`.replace(/\s+/g, ' ').trim();
        if (current.v.titleAr.includes(')')) extendingTitle = false;
        for (const cite of extractCitations(text)) current.v.items.push(ayahItem(line, cite));
        continue;
      }
      if (hadith.v && text) {
        if (isCommentary(text)) {
          hadith.v = null;
          current.v?.items.push({
            kind: 'AUTHOR_TEXT',
            line,
            hadithNumber: null,
            text,
            ayahFrom: null,
            ayahTo: null,
          });
        } else {
          hadith.v.text = hadith.v.text ? `${hadith.v.text} ${text}` : text;
        }
      } else if (current.v && arabicLetters(text) >= 8) {
        current.v.items.push({
          kind: 'AUTHOR_TEXT',
          line,
          hadithNumber: null,
          text,
          ayahFrom: null,
          ayahTo: null,
        });
      }
      if (current.v) {
        for (const cite of extractCitations(text)) current.v.items.push(ayahItem(line, cite));
      }
      continue;
    }

    const kitab = MUSLIM_KITAB.exec(raw);
    if (kitab?.[1]) {
      open('KITAB', kitab[1], `كتاب ${kitab[2] ?? ''}`.trim(), line);
      extendingTitle = !raw.includes(')');
      continue;
    }
    const bab = MUSLIM_BAB.exec(raw);
    if (bab?.[1]) {
      open('BAB', bab[1], `باب ${bab[2] ?? ''}`.trim(), line);
      extendingTitle = !raw.includes(')');
      continue;
    }
    const hadithLine = MUSLIM_HADITH.exec(raw);
    let numberText = hadithLine?.[1] ?? '';
    let rest = hadithLine?.[2] ?? '';
    // A few JK lines prefix the hadith number with the same digits repeated: `# 291429132913 2913`.
    if (numberText.length > 6) {
      const repeated = /^(\d+)\s+(.*)$/.exec(rest);
      if (repeated?.[1] && repeated[1].length <= 6) {
        numberText = repeated[1];
        rest = repeated[2] ?? '';
      }
    }
    if (numberText && Number(numberText) <= 2_147_483_647 && !/^(?:باب|كتاب)(?:\s|$)/.test(rest)) {
      if (!current.v) open('OTHER', '', 'مقدمة', line);
      extendingTitle = false;
      hadith.v = {
        kind: 'HADITH',
        line,
        hadithNumber: Number(numberText),
        text: rest,
        ayahFrom: null,
        ayahTo: null,
      };
      current.v?.items.push(hadith.v);
      if (current.v) {
        for (const cite of extractCitations(rest)) current.v.items.push(ayahItem(line, cite));
      }
    }
  }
  return sections;
}

function lineAt(text: string, offset: number): number {
  return text.slice(0, Math.max(0, offset)).split('\n').length;
}

const EASTERN_DIGIT = '0-9\\u0660-\\u0669\\u06F0-\\u06F9';

function kitabTitle(title: string): string {
  return title
    .replace(new RegExp(`[\\s(${EASTERN_DIGIT}.ـ\\-–—]+$`), '')
    .replace(/(?:^|\s)ه$/u, '')
    .trim();
}

function sameHeading(level: BookLevel, stored: string, next: string): boolean {
  const left = headingKey(stored);
  const right = headingKey(next);
  if (left === right) return true;
  if (level !== 'KITAB') return false;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= 12 && longer.startsWith(`${shorter} `);
}

function headingKey(title: string): string {
  return normalizeArabic(title)
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .replace(/ا{2,}(?=ل)/g, 'ا')
    .replace(/(^|\s)ال(?=ترغيب|ترهيب)/g, '$1')
    .replace(/(^|\s)و(?=[\u0621-\u064A])/g, '$1')
    .replace(/(?:غيرها|غيره|غيرهما)\s*$/, '')
    .replace(/(?:^|\s)ه$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A running header often ends with the hadith numbers printed on that page. */
function trimHeading(title: string): string {
  const range = new RegExp(
    `\\s*[.\\s]*[${EASTERN_DIGIT}][${EASTERN_DIGIT}\\sو,،.ـ\\-–—]*حد[يی]ث\\.?\\s*$`,
  );
  return title.replace(range, '').replace(/[.\s)]+$/u, '').trim();
}

function targhibParts(title: string): Array<{ level: BookLevel; title: string }> {
  const cleaned = trimHeading(title).replace(new RegExp(`^[${EASTERN_DIGIT}]+\\s*[-–—.]?\\s*`), '');
  const parts: Array<{ level: BookLevel; title: string }> = [];
  const at = cleaned.search(/ا{0,2}ل?ترغ[يی]ب|ا{0,2}ل?تره[يی]ب/);
  if (at > 0) {
    const left = kitabTitle(cleaned.slice(0, at).replace(/(?:\s+ه)+$/u, ''));
    const right = trimHeading(cleaned.slice(at).replace(/^ا(?=ال)/, ''));
    if (/^كتاب\s+\S/.test(left)) parts.push({ level: 'KITAB', title: left });
    if (/^ا{0,2}ل?تره[يی]ب/.test(right)) parts.push({ level: 'TARHIB', title: right });
    else if (/^ا{0,2}ل?ترغ[يی]ب/.test(right)) parts.push({ level: 'TARGHIB', title: right });
  }
  if (parts.length === 0 && /^كتاب\s+\S/.test(cleaned)) {
    const numbered = new RegExp(`^(كتاب\\s+.*?)(?:\\s+[${EASTERN_DIGIT}]+)?\\s*[-–—.]\\s+(.+)$`).exec(cleaned);
    const kitab = kitabTitle(numbered?.[1] ?? cleaned);
    parts.push({ level: 'KITAB', title: kitab });
    const rest = numbered?.[2]?.trim();
    if (rest && /[\u0621-\u064A]{3}/.test(rest) && !new RegExp(`^[${EASTERN_DIGIT}\\s]+$`).test(rest)) {
      parts.push({ level: 'OTHER', title: trimHeading(rest) });
    }
  } else if (parts.length === 0) {
    const folded = normalizeArabic(cleaned);
    if (/^الترهيب/.test(folded)) parts.push({ level: 'TARHIB', title: cleaned });
    else if (/^الترغيب/.test(folded)) parts.push({ level: 'TARGHIB', title: cleaned });
  }
  return parts;
}

/** Sahih al-Targhib is the OCR edition. Headings and narrations only. */
export function parseTarghibStructure(joined: string): ParsedSection[] {
  const { narrations } = parseTarghib(joined);
  const sections: ParsedSection[] = [];
  const stack: number[] = [];
  const current = slot<ParsedSection | null>(null);

  const open = (level: BookLevel, title: string, line: number, volume: string, page: string): void => {
    const sameIndex = [...sections.keys()].reverse().find((index) => {
      const section = sections[index];
      if (!section || section.level !== level || !sameHeading(level, section.titleAr, title)) return false;
      if (section.parentIndex == null) return true;
      const parent = sections[section.parentIndex];
      return parent != null && stack.includes(section.parentIndex);
    });
    if (sameIndex !== undefined) {
      const chain: number[] = [];
      const seen = new Set<number>();
      let cursor: number | null = sameIndex;
      while (cursor !== null && !seen.has(cursor)) {
        seen.add(cursor);
        chain.push(cursor);
        cursor = sections[cursor]?.parentIndex ?? null;
      }
      stack.length = 0;
      stack.push(...chain.reverse());
      current.v = sections[sameIndex] ?? null;
      return;
    }
    const section: ParsedSection = {
      level,
      number: null,
      titleAr: title,
      line,
      volume,
      page,
      parentIndex: null,
      rank: rankOf(level, title),
      items: [],
    };
    while (stack.length > 0 && (sections[stack[stack.length - 1]!]?.rank ?? 0) >= section.rank) stack.pop();
    section.parentIndex = stack.at(-1) ?? null;
    sections.push(section);
    stack.push(sections.length - 1);
    current.v = section;
  };

  for (const narration of narrations) {
    const line = lineAt(joined, narration.start);
    for (const part of targhibParts(narration.chapterTitle ?? '')) {
      open(part.level, part.title, line, narration.volume, narration.page);
    }
    if (!current.v) open('OTHER', 'صدر الكتاب', line, narration.volume, narration.page);
    current.v!.items.push({
      kind: 'HADITH',
      line,
      hadithNumber: narration.number,
      text: narration.textAr,
      ayahFrom: null,
      ayahTo: null,
    });
    for (const cite of extractCitations(narration.textAr)) current.v!.items.push(ayahItem(line, cite));
  }
  return sections;
}
