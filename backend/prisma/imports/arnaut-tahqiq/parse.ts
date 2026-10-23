/**
 * Narrations and Arna'ut's verdicts from the OpenITI (Shamela) text of
 * Musnad Ahmad and al-Ihsan (Sahih Ibn Hibban).
 *
 * Musnad: «N - حدثنا …» then «# تعليق شعيب الأرنؤوط : <verdict>».
 * Ihsan: «N - أخبرنا …», then «# __________L» and al-Albani's verdict, then
 * «# S» and Arna'ut's. Only the S block is read; the L block is skipped whole
 * (al-Albani's gradings are not used on this site).
 */

export interface TahqiqEntry {
  /** Hadith number as printed in the file. */
  number: number;
  /** Narration text with page and section markers removed. */
  text: string;
  /** Arna'ut's verdict, or null when the file gives none. */
  verdict: string | null;
}

const HADITH_START = /^(\d+)\s*-\s+(.*)$/;
const MUSNAD_VERDICT = /^تعليق شعيب الأرنؤوط\s*:\s*(.*)$/;

/**
 * «# a\n~~b» → one paragraph per «#», in-line «# » too (a heading followed by «# 9 - …»).
 * A continuation line that opens a numbered narration («~~7 - حدثنا») starts a paragraph:
 * in the Musnad file it directly follows the previous verdict.
 */
function paragraphs(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .replace(/\n~~(?=\d+\s*-\s)/g, '\n')
    .replace(/\n~~/g, ' ')
    .split(/\n|(?<=\S)#\s/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean);
}

export function cleanText(text: string): string {
  return text
    .replace(/PageV\d+P\d+|ms\d+/g, ' ')
    .replace(/-\[\d+\]-/g, ' ')
    .replace(/\[\d+\s*:\s*\d+\]/g, ' ')
    .replace(/§/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHeading(paragraph: string): boolean {
  return paragraph.startsWith('|||') || paragraph.startsWith('META') || paragraph === '§';
}

export function parseMusnad(text: string): TahqiqEntry[] {
  const entries: TahqiqEntry[] = [];
  let current: TahqiqEntry | null = null;
  for (const paragraph of paragraphs(text)) {
    const start = HADITH_START.exec(paragraph);
    if (start) {
      if (current) entries.push(current);
      current = { number: Number(start[1]), text: start[2]!, verdict: null };
      continue;
    }
    if (!current) continue;
    const verdict = MUSNAD_VERDICT.exec(paragraph);
    if (verdict) {
      current.verdict ??= cleanText(verdict[1]!);
      continue;
    }
    if (isHeading(paragraph)) continue;
    if (current.verdict === null) current.text += ` ${paragraph}`;
  }
  if (current) entries.push(current);
  return entries.map((entry) => ({ ...entry, text: cleanText(entry.text) }));
}

export function parseIhsan(text: string): TahqiqEntry[] {
  const entries: TahqiqEntry[] = [];
  let current: TahqiqEntry | null = null;
  let state: 'text' | 'albani' | 'arnaut' | 'done' = 'done';
  for (const paragraph of paragraphs(text)) {
    const start = HADITH_START.exec(paragraph);
    if (start) {
      if (current) entries.push(current);
      current = { number: Number(start[1]), text: start[2]!, verdict: null };
      state = 'text';
      continue;
    }
    if (!current) continue;
    if (/^_+L$/.test(paragraph)) {
      state = 'albani';
      continue;
    }
    if (paragraph === 'S') {
      state = 'arnaut';
      continue;
    }
    if (isHeading(paragraph)) {
      state = 'done';
      continue;
    }
    if (state === 'text') current.text += ` ${paragraph}`;
    else if (state === 'arnaut' && current.verdict === null) current.verdict = cleanText(paragraph);
  }
  if (current) entries.push(current);
  return entries.map((entry) => ({ ...entry, text: cleanText(entry.text) }));
}
