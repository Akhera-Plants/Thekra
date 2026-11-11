/**
 * Layout of the downloadable share image (1080×1350, portrait 4:5). Pure: the caller supplies
 * a `measure` function (canvas `measureText` in the browser, a fixed-width stub in tests).
 *
 * Quran and hadith text is never cut. The body is word-wrapped at the largest font size that
 * fits between the heading and the attribution; when even the minimum readable size does not
 * fit, the layout says so and the UI offers link/text sharing only.
 */

import type { ShareBodyFace } from './share-text';

export const SHARE_IMAGE = {
  width: 1080,
  height: 1350,
  /** Outer margin to the drawn card. */
  frameInset: 40,
  paddingX: 112,
  paddingTop: 120,
  paddingBottom: 104,
  headingSize: 30,
  headingGap: 48,
  bodyMaxSize: 64,
  /** About 13px on a 390px-wide phone screen: the smallest size we call readable. */
  bodyMinSize: 36,
  bodyStep: 2,
  bodyMetaGap: 64,
  metaSize: 28,
  metaLineHeight: 1.6,
  metaFooterGap: 48,
  footerNameSize: 34,
  footerHostSize: 24,
  footerHeight: 92,
} as const;

/** Line height per face: the Quran face carries marks above and below the line. */
export function bodyLineHeightFactor(face: ShareBodyFace): number {
  if (face === 'quran') return 1.9;
  if (face === 'arabic') return 1.75;
  return 1.45;
}

export type ShareTextRole = 'heading' | 'body' | 'meta' | 'footer';

/** Width in pixels of `text` drawn at `fontSize` in the face used for `role`. */
export type MeasureText = (text: string, fontSize: number, role: ShareTextRole) => number;

export interface ShareImageInput {
  body: string;
  bodyFace: ShareBodyFace;
  attribution: string[];
}

export interface ShareImageFit {
  fits: true;
  fontSize: number;
  lineHeight: number;
  bodyLines: string[];
  /** Top of the first body line box. */
  bodyTop: number;
  metaLines: string[];
  metaLineHeight: number;
  metaTop: number;
  headingTop: number;
  footerTop: number;
}

export interface ShareImageNoFit {
  fits: false;
}

export type ShareImageLayout = ShareImageFit | ShareImageNoFit;

/**
 * Greedy word wrap by measured width. Paragraphs (line breaks in the text) start new lines.
 * Returns null when a single word is wider than `maxWidth`: a word is never broken or dropped.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] | null {
  const lines: string[] = [];
  const paragraphs = text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      if (measure(word) > maxWidth) return null;
      const candidate = line ? `${line} ${word}` : word;
      if (!line || measure(candidate) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Decides the body font size and every line, or that the text does not fit. */
export function layoutShareImage(input: ShareImageInput, measure: MeasureText): ShareImageLayout {
  const m = SHARE_IMAGE;
  const contentWidth = m.width - 2 * m.paddingX;
  const metaLineHeight = m.metaSize * m.metaLineHeight;

  const metaLines: string[] = [];
  for (const line of input.attribution) {
    const wrapped = wrapLines(line, contentWidth, (value) => measure(value, m.metaSize, 'meta'));
    if (!wrapped) return { fits: false };
    metaLines.push(...wrapped);
  }

  const headingTop = m.paddingTop;
  const contentTop = headingTop + m.headingSize * 1.4 + m.headingGap;
  const footerTop = m.height - m.paddingBottom - m.footerHeight;
  const metaTop = footerTop - m.metaFooterGap - metaLines.length * metaLineHeight;
  const available = metaTop - m.bodyMetaGap - contentTop;
  if (available <= 0 || !input.body.trim()) return { fits: false };

  const factor = bodyLineHeightFactor(input.bodyFace);
  for (let size = m.bodyMaxSize; size >= m.bodyMinSize; size -= m.bodyStep) {
    const bodyLines = wrapLines(input.body, contentWidth, (value) => measure(value, size, 'body'));
    if (!bodyLines) continue;
    const lineHeight = size * factor;
    const height = bodyLines.length * lineHeight;
    if (height <= available) {
      return {
        fits: true,
        fontSize: size,
        lineHeight,
        bodyLines,
        bodyTop: contentTop + (available - height) / 2,
        metaLines,
        metaLineHeight,
        metaTop,
        headingTop,
        footerTop,
      };
    }
  }
  return { fits: false };
}
