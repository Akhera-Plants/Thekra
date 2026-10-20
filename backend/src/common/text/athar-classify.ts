/**
 * Classify a narration as MARFU (Prophet's words/action) vs ATHAR (Companion
 * or later speaker), and extract the athar speaker for YAML matching.
 */

export type NarrationKind = 'MARFU' | 'ATHAR';

export interface AtharClassification {
  kind: NarrationKind;
  /** Raw speaker phrase as written, when ATHAR (e.g. «ابن مسعود»). */
  speakerRaw: string | null;
}

const MARKS = /[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/g;

/** Fold Arabic for cue / name matching. */
export function foldArabic(input: string): string {
  return input
    .replace(MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

const PROPHET_NAME = '(?:رسول\\s+الله|النبي|نبي\\s+الله)';
const SALAWAT = '(?:صلي\\s+الله\\s+عليه(?:\\s+و(?:اله\\s+)?سلم)?|عليه\\s+الصلاه\\s+والسلام)';

/** Clear prophetic attribution → MARFU. */
const MARFU_CUES = [
  new RegExp(`قال\\s+${PROPHET_NAME}`, 'i'),
  new RegExp(`يقول\\s+${PROPHET_NAME}`, 'i'),
  new RegExp(`عن\\s+${PROPHET_NAME}`, 'i'),
  new RegExp(`ان\\s+${PROPHET_NAME}`, 'i'),
  new RegExp(`سمعت\\s+${PROPHET_NAME}`, 'i'),
  new RegExp(`يا\\s+${PROPHET_NAME}`, 'i'),
  new RegExp(`${PROPHET_NAME}\\s+${SALAWAT}\\s*(?:قال|يقول)?`, 'i'),
  /صلي الله عليه وسلم\s*(?:قال|يقول)/i,
];

/**
 * Last «قال <name>» / «عن <name> قال» before the saying.
 * Names stop at قال / : / quote marks.
 */
const SPEAKER_PATTERNS = [
  /(?:^|[\s،,])(?:قال|يقول)\s+((?:ال|ابن|ابي|أبو|أم|عن)?[\u0600-\u06FF\s]{2,40}?)(?=\s*(?:[:：]|«|"|قال|يقول|$))/g,
  /(?:^|[\s،,])عن\s+((?:ال|ابن|ابي|أبو|أم)?[\u0600-\u06FF\s]{2,40}?)\s+قال/g,
];

function lastSpeaker(text: string): string | null {
  const folded = foldArabic(text);
  let best: string | null = null;
  let bestIndex = -1;
  for (const pattern of SPEAKER_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of folded.matchAll(pattern)) {
      const name = (match[1] ?? '').replace(/\s+/g, ' ').trim();
      if (name.length < 2) continue;
      // Skip prophetic names mistaken as speakers.
      if (/رسول الله|النبي|نبي الله/.test(name)) continue;
      const index = match.index ?? -1;
      if (index >= bestIndex) {
        bestIndex = index;
        best = name;
      }
    }
  }
  return best;
}

export function classifyNarration(text: string): AtharClassification {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return { kind: 'ATHAR', speakerRaw: null };

  const folded = foldArabic(trimmed);
  for (const cue of MARFU_CUES) {
    if (cue.test(folded)) {
      return { kind: 'MARFU', speakerRaw: null };
    }
  }

  return { kind: 'ATHAR', speakerRaw: lastSpeaker(trimmed) };
}

export interface AtharSpeakerEntry {
  key: string;
  ar: string;
  forms: string[];
}

export interface AtharSpeakerMatch {
  key: string;
  ar: string;
}

function coreName(folded: string): string {
  return folded
    .replace(/^(?:عن|قال|يقول|قالت)\s+/g, '')
    .replace(/\s+(?:قال|يقول|قالت)$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Match a raw speaker string against YAML forms (longest form wins). */
export function matchAtharSpeaker(
  speakerRaw: string | null | undefined,
  speakers: readonly AtharSpeakerEntry[],
): AtharSpeakerMatch | null {
  if (!speakerRaw) return null;
  const folded = foldArabic(speakerRaw);
  const core = coreName(folded);
  let best: AtharSpeakerMatch | null = null;
  let bestLen = 0;
  for (const entry of speakers) {
    for (const form of entry.forms) {
      const ff = foldArabic(form);
      const formCore = coreName(ff);
      if (!ff) continue;
      // Exact / substring on the full form, or on the name core after stripping
      // «عن/قال». Never let a longer form swallow a shorter speaker
      // («بن عمرو» must not claim «بن عمر»).
      const hit =
        folded === ff ||
        folded.includes(ff) ||
        (core.length >= 3 && formCore.length >= 3 && (core === formCore || core.includes(formCore)));
      if (!hit) continue;
      const score = Math.max(
        folded === ff || folded.includes(ff) ? ff.length : 0,
        core === formCore || core.includes(formCore) ? formCore.length : 0,
      );
      if (score > bestLen) {
        bestLen = score;
        best = { key: entry.key, ar: entry.ar };
      }
    }
  }
  return best;
}
