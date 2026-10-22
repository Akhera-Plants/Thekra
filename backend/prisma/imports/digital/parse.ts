/**
 * OpenITI records for the digital editions. A numbered heading is one narration.
 * A chapter heading is the title that covers the narrations after it.
 * A section heading (a kabira, or a Minhaj chapter) keeps its prose, and any
 * paragraph that quotes the Prophet is also a narration.
 */
import { parseLeadingOrdinal } from '../lib/arabic-ordinal.js';
import { readRecords } from '../lib/openiti.js';
import { stripPageMarkers } from '../../../src/common/text/strip-page-markers.js';

export interface DigitalPiece {
  kind: 'narration' | 'section';
  number: number;
  title: string | null;
  textAr: string;
  volume: string | null;
  page: string | null;
  narrations: string[];
}

const NUMBERED = /^(\d+)\s*[-–—]\s*$/;
const CHAPTER = /(?:^|\s)(?:كتاب|باب|فصل)(?:\s|$)/;
const PROPHET = /قال\s+(?:رسول الله|النبي)|صلى الله عليه وسلم|عن النبي/;

export function arabicLetters(text: string): number {
  return (text.match(/[\u0621-\u064A]/g) ?? []).length;
}

function place(volume: number | null, page: number | null): { volume: string | null; page: string | null } {
  return {
    volume: volume == null ? null : String(volume),
    page: page == null ? null : String(page),
  };
}

export function parseNumberedBook(source: string): DigitalPiece[] {
  let chapter: string | null = null;
  const pieces: DigitalPiece[] = [];
  for (const record of readRecords(source)) {
    const heading = record.heading.trim();
    if (!heading) continue;
    if (CHAPTER.test(heading) && !NUMBERED.test(heading)) {
      chapter = heading;
      continue;
    }
    const match = NUMBERED.exec(heading);
    if (!match?.[1]) continue;
    const textAr = stripPageMarkers(record.body.trim());
    if (arabicLetters(textAr) < 40) continue;
    pieces.push({
      kind: 'narration',
      number: Number(match[1]),
      title: chapter,
      textAr,
      ...place(record.volume, record.page),
      narrations: [],
    });
  }
  return pieces;
}

export function prophetParagraphs(text: string): string[] {
  return text
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => PROPHET.test(paragraph) && arabicLetters(paragraph) >= 40);
}

/** Sections whose heading starts with «الكبيرة» plus an ordinal. */
export function parseKabairSections(source: string): DigitalPiece[] {
  const pieces: DigitalPiece[] = [];
  for (const record of readRecords(source)) {
    if (!record.heading.startsWith('الكبيرة ')) continue;
    const ordinal = parseLeadingOrdinal(record.heading.slice('الكبيرة '.length));
    if (!ordinal) continue;
    const textAr = stripPageMarkers(record.body.trim());
    if (arabicLetters(textAr) < 40) continue;
    pieces.push({
      kind: 'section',
      number: ordinal.value,
      title: record.heading.trim(),
      textAr,
      ...place(record.volume, record.page),
      narrations: prophetParagraphs(textAr),
    });
  }
  return pieces;
}

/** Minhaj chapters: a heading that is a كتاب, باب, or فصل, with its prose. */
export function parseMinhajSections(source: string): DigitalPiece[] {
  const pieces: DigitalPiece[] = [];
  let number = 0;
  for (const record of readRecords(source)) {
    const heading = record.heading.trim();
    if (!/^(?:\d+\s+)?(?:كتاب|باب|فصل)(?:\s|:|$)/.test(heading)) continue;
    const textAr = stripPageMarkers(record.body.trim());
    if (arabicLetters(textAr) < 40) continue;
    number += 1;
    pieces.push({
      kind: 'section',
      number,
      title: heading,
      textAr,
      ...place(record.volume, record.page),
      narrations: prophetParagraphs(textAr),
    });
  }
  return pieces;
}
