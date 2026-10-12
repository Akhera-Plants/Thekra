/**
 * A chapter title is classified from the author's own words.
 * AVOID and DO are linked. NEUTRAL is not. Both at once is ambiguous.
 */
import { foldArabic } from '../waqfeya/clean.js';
import { parseLeadingOrdinal } from '../lib/arabic-ordinal.js';

export type ChapterKind = 'AVOID' | 'DO' | 'NEUTRAL' | 'AMBIGUOUS';

export interface ChapterClassification {
  kind: ChapterKind;
  /** Folded topic, without a leading «ال», used to cluster one subject across books. */
  topic: string | null;
  /** One class and a real topic. Ambiguous titles are linked as not reviewed. */
  explicit: boolean;
}

const AVOID = ['الترهيب من', 'التحريم', 'تحريم', 'النهي عن', 'النهي', 'ذم', 'كبيره'];
const DO_MARKERS = ['الترغيب في', 'الترغيب', 'استحباب', 'الفضل', 'فضل', 'الحث على', 'الحث'];

function asWord(text: string, marker: string): boolean {
  const pattern = new RegExp(`(?:^|\\s)و?${marker}(?:\\s|$)`);
  return pattern.test(text);
}

function firstMarker(text: string, markers: readonly string[]): string | null {
  let found: { marker: string; at: number } | null = null;
  for (const marker of markers) {
    if (!asWord(text, marker)) continue;
    const at = text.indexOf(marker);
    if (!found || at < found.at) found = { marker, at };
  }
  return found?.marker ?? null;
}

function topicAfter(text: string, marker: string): string {
  const at = text.indexOf(marker);
  return text
    .slice(at + marker.length)
    .trim()
    .replace(/^(?:من|في|عن|علي)\s+/, '')
    .replace(/^ال(?=\S)/, '')
    .split(/\s+[–—-]\s+/)[0]!
    .trim();
}

function kabiraTopic(title: string): string | null {
  const folded = foldArabic(title).replace(/^(?:كتاب|باب|فصل)\s+/, '');
  if (!folded.startsWith('الكبيره')) return null;
  const after = title.replace(/^.*?(?:الكبيرة|الكبيره)\s+/, '');
  const ordinal = parseLeadingOrdinal(after);
  const name = (ordinal ? after.slice(ordinal.length) : after).replace(/^في\s+/, '').trim();
  const topic = foldArabic(name).replace(/^ال(?=\S)/, '');
  return topic.length >= 3 ? topic : null;
}

export function classifyChapter(title: string | null | undefined): ChapterClassification {
  if (!title?.trim()) return { kind: 'NEUTRAL', topic: null, explicit: false };
  const kabira = kabiraTopic(title);
  if (kabira) return { kind: 'AVOID', topic: kabira, explicit: true };

  const folded = foldArabic(title)
    .replace(/^[0-9]+\s*/, '')
    .replace(/^(?:كتاب|باب|فصل)\s+/, '')
    .trim();
  const avoid = firstMarker(folded, AVOID);
  const doing = firstMarker(folded, DO_MARKERS);
  if (avoid && doing) return { kind: 'AMBIGUOUS', topic: folded, explicit: false };
  const marker = avoid ?? doing;
  if (!marker) return { kind: 'NEUTRAL', topic: null, explicit: false };
  const topic = topicAfter(folded, marker);
  if (topic.replace(/\s/g, '').length < 3) return { kind: 'AMBIGUOUS', topic: folded, explicit: false };
  return { kind: avoid ? 'AVOID' : 'DO', topic, explicit: true };
}

/** Same subject across books: one folded topic, one leading «ال» removed. */
export function topicKey(topic: string): string {
  return foldArabic(topic).replace(/^ال(?=\S)/, '').replace(/\s+/g, ' ').trim();
}
