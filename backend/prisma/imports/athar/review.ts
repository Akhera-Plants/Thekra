/**
 * Reviewer sheet for listed athar. Empty decision stays hidden.
 * correctedText and correctedAttribution override the stored story.
 */
import { readFileSync } from 'node:fs';
import type { AtharAttributionKind, AtharReviewDecision } from '@prisma/client';

export const REVIEW_HEADER = [
  'quoteId',
  'speakerKey',
  'speakerAr',
  'attribution',
  'book',
  'number',
  'atharTextAr',
  'decision',
  'correctedText',
  'correctedAttribution',
].join('\t');

export interface ReviewRow {
  quoteId: string;
  speakerKey: string;
  speakerAr: string;
  attribution: string;
  book: string;
  number: string;
  atharTextAr: string;
  decision: '' | 'keep' | 'drop';
  correctedText: string;
  correctedAttribution: '' | AtharAttributionKind;
}

export interface StoredAtharReview {
  atharReviewDecision: AtharReviewDecision | null;
  atharTextAr: string | null;
  atharAttributionKind: AtharAttributionKind | null;
}

export interface ReviewWrite {
  atharReviewDecision: AtharReviewDecision;
  atharTextAr?: string;
  atharAttributionKind?: AtharAttributionKind;
}

export function bookLabel(provider: string | null): string {
  if (provider === 'book:shuab-iman') return 'شعب الإيمان';
  if (provider === 'book:ibn-mubarak-zuhd') return 'الزهد لابن المبارك';
  if (provider === 'book:ibn-qudama-minhaj') return 'منهاج القاصدين';
  if (provider === 'book:nawawi-adhkar') return 'الأذكار';
  if (provider?.startsWith('book:ibn-abi-dunya')) return 'ابن أبي الدنيا';
  return provider ?? '';
}

function parseDecision(value: string, quoteId: string): ReviewRow['decision'] {
  const folded = value.trim().toLowerCase();
  if (!folded) return '';
  if (folded === 'keep' || folded === 'drop') return folded;
  throw new Error(`athar review ${quoteId}: decision must be keep, drop, or empty (got ${value})`);
}

function parseAttribution(value: string, quoteId: string): ReviewRow['correctedAttribution'] {
  const folded = value.trim().toUpperCase();
  if (!folded) return '';
  if (folded === 'SAID' || folded === 'NARRATED') return folded;
  throw new Error(`athar review ${quoteId}: correctedAttribution must be SAID, NARRATED, or empty`);
}

export function parseReviewTsv(text: string): ReviewRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const body = lines[0] === REVIEW_HEADER ? lines.slice(1) : lines;
  return body.map((line) => {
    const cells = line.split('\t');
    const quoteId = cells[0] ?? '';
    return {
      quoteId,
      speakerKey: cells[1] ?? '',
      speakerAr: cells[2] ?? '',
      attribution: cells[3] ?? '',
      book: cells[4] ?? '',
      number: cells[5] ?? '',
      atharTextAr: cells[6] ?? '',
      decision: parseDecision(cells[7] ?? '', quoteId),
      correctedText: cells[8] ?? '',
      correctedAttribution: parseAttribution(cells[9] ?? '', quoteId),
    };
  });
}

export function readReviewDecisions(path: string): Map<string, Pick<ReviewRow, 'decision' | 'correctedText' | 'correctedAttribution'>> {
  let text = '';
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return new Map();
  }
  const out = new Map<string, Pick<ReviewRow, 'decision' | 'correctedText' | 'correctedAttribution'>>();
  for (const row of parseReviewTsv(text)) {
    if (!row.quoteId) continue;
    out.set(row.quoteId, {
      decision: row.decision,
      correctedText: row.correctedText,
      correctedAttribution: row.correctedAttribution,
    });
  }
  return out;
}

/** Fields to write, or null when the row already matches (a second run writes nothing). */
export function reviewWrite(current: StoredAtharReview, row: ReviewRow): ReviewWrite | null {
  if (!row.decision) return null;
  const decision: AtharReviewDecision = row.decision === 'keep' ? 'KEEP' : 'DROP';
  const nextText = row.correctedText.trim() ? row.correctedText.trim() : current.atharTextAr;
  const nextAttribution = row.correctedAttribution || current.atharAttributionKind;
  const textChanges = row.correctedText.trim().length > 0 && nextText !== current.atharTextAr;
  const attributionChanges = !!row.correctedAttribution && nextAttribution !== current.atharAttributionKind;
  if (current.atharReviewDecision === decision && !textChanges && !attributionChanges) return null;
  const write: ReviewWrite = { atharReviewDecision: decision };
  if (textChanges && nextText) write.atharTextAr = nextText;
  if (attributionChanges && nextAttribution) write.atharAttributionKind = nextAttribution;
  return write;
}
