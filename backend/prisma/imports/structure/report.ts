/**
 * The files the reviewer reads. Titles stay verbatim.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedItem, ParsedSection } from './parse.js';

export interface WrittenSection {
  id: string;
  parsed: ParsedSection;
}

export interface BookReport {
  key: string;
  titleAr: string;
  sections: WrittenSection[];
}

const DOCS = join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'taxonomy');

export function parentPath(sections: readonly ParsedSection[], index: number): string {
  const titles: string[] = [];
  const seen = new Set<number>();
  let cursor: number | null = sections[index]?.parentIndex ?? null;
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor);
    const section = sections[cursor];
    if (!section) break;
    titles.push(section.titleAr);
    cursor = section.parentIndex;
  }
  return titles.reverse().join(' › ');
}

function counts(items: readonly ParsedItem[]): { ayah: number; hadith: number; author: number; keys: string } {
  const ayah = items.filter((item) => item.kind === 'AYAH');
  return {
    ayah: ayah.length,
    hadith: items.filter((item) => item.kind === 'HADITH').length,
    author: items.filter((item) => item.kind === 'AUTHOR_TEXT').length,
    keys: ayah.map((item) => item.ayahFrom === item.ayahTo ? item.ayahFrom : `${item.ayahFrom}..${item.ayahTo}`).join(' '),
  };
}

function tsvCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, ' ').trim();
}

export function sectionTsv(book: BookReport): string {
  const parsed = book.sections.map((section) => section.parsed);
  const lines = ['sectionId\tparentPath\tlevel\tnumber\ttitleAr\tayah\thadith\tauthor\tayahKeys'];
  book.sections.forEach((section, index) => {
    const tally = counts(section.parsed.items);
    lines.push([
      section.id,
      tsvCell(parentPath(parsed, index)),
      section.parsed.level,
      section.parsed.number ?? '',
      tsvCell(section.parsed.titleAr),
      String(tally.ayah),
      String(tally.hadith),
      String(tally.author),
      tally.keys,
    ].join('\t'));
  });
  return `${lines.join('\n')}\n`;
}

function sampleIndexes(size: number, seed: number): number[] {
  let state = seed >>> 0;
  const pool = [...Array(size).keys()];
  const picked: number[] = [];
  while (picked.length < Math.min(5, size)) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    picked.push(pool.splice(state % pool.length, 1)[0]!);
  }
  return picked.sort((a, b) => a - b);
}

function preview(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function reference(item: ParsedItem): string {
  if (item.kind === 'AYAH') return item.ayahFrom === item.ayahTo ? (item.ayahFrom ?? '') : `${item.ayahFrom}..${item.ayahTo}`;
  if (item.kind === 'HADITH') return item.hadithNumber == null ? 'بلا رقم' : String(item.hadithNumber);
  return 'نص المؤلف';
}

export function structureReport(books: readonly BookReport[]): string {
  const lines: string[] = [
    '# Book structure',
    '',
    'Mechanical import of headings and the items under them. No sin, good deed, or topic was created or linked.',
    'Five sections per book are chosen with a fixed seed so a second reading sees the same sample.',
    '',
  ];
  for (const book of books) {
    const levels = new Map<string, number>();
    const kinds = new Map<string, number>();
    for (const section of book.sections) {
      levels.set(section.parsed.level, (levels.get(section.parsed.level) ?? 0) + 1);
      for (const item of section.parsed.items) kinds.set(item.kind, (kinds.get(item.kind) ?? 0) + 1);
    }
    lines.push(`## ${book.titleAr} (\`${book.key}\`)`, '');
    lines.push(`Sections: ${book.sections.length}.`);
    lines.push('');
    lines.push('| Level | Sections |', '| --- | ---: |');
    for (const [level, count] of [...levels].sort()) lines.push(`| ${level} | ${count} |`);
    lines.push('');
    lines.push('| Kind | Items |', '| --- | ---: |');
    for (const kind of ['AYAH', 'HADITH', 'AUTHOR_TEXT']) {
      lines.push(`| ${kind} | ${kinds.get(kind) ?? 0} |`);
    }
    lines.push('');
    const parsed = book.sections.map((section) => section.parsed);
    for (const index of sampleIndexes(book.sections.length, 20261013)) {
      const section = book.sections[index];
      if (!section) continue;
      const path = parentPath(parsed, index);
      lines.push(`### ${section.parsed.titleAr}`);
      lines.push('');
      lines.push(`- id: \`${section.id}\``);
      lines.push(`- level: ${section.parsed.level}${section.parsed.number ? ` ${section.parsed.number}` : ''}`);
      lines.push(`- parent: ${path || '—'}`);
      lines.push(`- corpus line: ${section.parsed.line}`);
      lines.push('');
      if (section.parsed.items.length === 0) {
        lines.push('No items under this heading.');
        lines.push('');
        continue;
      }
      for (const item of section.parsed.items) {
        const text = preview(item.text);
        lines.push(`- ${item.kind} ${reference(item)} — line ${item.line}${text ? ` — ${text}` : ''}`);
      }
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}

export function writeStructureDocs(books: readonly BookReport[]): void {
  const dir = join(DOCS, 'sections');
  mkdirSync(dir, { recursive: true });
  for (const book of books) writeFileSync(join(dir, `${book.key}.tsv`), sectionTsv(book));
  writeFileSync(join(DOCS, 'structure-report.md'), structureReport(books));
}
