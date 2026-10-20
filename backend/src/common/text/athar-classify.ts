/**
 * Classify a narration as MARFU (Prophet's words/action) vs ATHAR (Companion
 * or later speaker), and extract the athar speaker for YAML matching.
 *
 * Rules (athar audit):
 * - Text must be a quoted saying; a chain that stops at «عن فلان» is not an athar.
 * - Speaker = the person whose words are quoted (`قال فلان:` before the quote),
 *   never a name buried in the isnad.
 * - Prophetic reports (`رفعه`, `قال رسول الله`, …) are MARFU, never athar.
 * - OCR noise is stripped; residual junk rejects the row.
 */

export type NarrationKind = 'MARFU' | 'ATHAR' | 'REJECT';

export interface AtharClassification {
  kind: NarrationKind;
  /** Raw speaker phrase as written, when ATHAR (e.g. «ابن مسعود»). */
  speakerRaw: string | null;
  /** The quoted saying only (when ATHAR), for display / audit. */
  saying: string | null;
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

/** Strip OCR / markup noise; returns cleaned text. */
export function stripOcrNoise(input: string): string {
  return input
    .replace(/\[\s*\$\s*\]/g, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/\|+/g, ' ')
    .replace(/\{\s*\}/g, ' ')
    .replace(/[\$#~^]+/g, ' ')
    .replace(/(?:^|\s)\d{1,4}(?:\s|$)/g, ' ')
    .replace(/\(\s*\d+\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Residual OCR / markup that means the text is still dirty. */
const OCR_RESIDUAL = /[\[\]\{\}\|\$~^]|\bms\d+\b|PageV\d+P\d+/i;

function arabicLetters(text: string): number {
  return (text.match(/[\u0621-\u064A]/g) ?? []).length;
}

const PROPHET_NAME = '(?:رسول\\s+الله|النبي|نبي\\s+الله)';
const SALAWAT = '(?:صلي\\s+الله\\s+عليه(?:\\s+و(?:اله\\s+)?سلم)?|عليه\\s+الصلاه\\s+والسلام)';

/** JS `\b` does not work on Arabic — use explicit edges. */
const EDGE = '(?:^|[^\\u0600-\\u06FF])';
const EDGE_END = '(?:$|[^\\u0600-\\u06FF])';

/** Clear prophetic attribution → MARFU. */
const MARFU_CUES: RegExp[] = [
  // Optional leading و (ورفعه) — Arabic letters are not JS word chars.
  new RegExp(`${EDGE}و?رفعه${EDGE_END}`),
  new RegExp(`${EDGE}و?يرفعه${EDGE_END}`),
  new RegExp(`${EDGE}و?مرفوعا${EDGE_END}`),
  new RegExp(`${EDGE}يبلغ\\s+به(?:\\s+النبي)?${EDGE_END}`),
  new RegExp(`${EDGE}روايه${EDGE_END}`), // «عن أبي هريرة، رواية»
  new RegExp(`قال\\s+${PROPHET_NAME}`),
  new RegExp(`يقول\\s+${PROPHET_NAME}`),
  new RegExp(`عن\\s+${PROPHET_NAME}`),
  new RegExp(`ان\\s+${PROPHET_NAME}`),
  new RegExp(`سمعت\\s+${PROPHET_NAME}`),
  new RegExp(`يا\\s+${PROPHET_NAME}`),
  new RegExp(`${PROPHET_NAME}\\s+${SALAWAT}\\s*(?:قال|يقول)?`),
  /صلي الله عليه وسلم\s*(?:قال|يقول)/,
  new RegExp(`${PROPHET_NAME}\\s+${SALAWAT}`),
];

/**
 * A person name in an isnad/quote frame: no commas, no nested «عن».
 * e.g. ميمون بن ابي شبيب، الحسن، عمر بن الخطاب
 */
const PERSON =
  '(?:ال|ابن|ابي|أبو|ام)?[\\u0600-\\u06FF]+(?:\\s+(?:بن|ابن|بنت|ابي|أبو|ام)?[\\u0600-\\u06FF]+){0,5}';

/** رضي الله عنه / رحمها الله between the name and قال (after foldArabic). */
const HONORIFIC =
  '(?:\\s+رضي\\s+الله\\s+عن[هها]|\\s+رضي\\s+الله\\s+عنهم|\\s+رحمه\\s+الله|\\s+رحمها\\s+الله)?';

/**
 * Quote introducer: «قال فلان:» / «يقول فلان «» / «قالت فلان:» / «عن فلان قال:».
 * Name stops before colon, quote mark, or «لـ» (قال حذيفة لسلمان).
 * Must have a quote delimiter — never a bare isnad «قال».
 */
const QUOTE_INTRO = new RegExp(
  `(?:^|[\\s،,])(?:قال|يقول|قالت)\\s+(${PERSON})${HONORIFIC}(?:\\s+ل(?:ـ)?${PERSON})?\\s*([:：]|«|"|”|„)`,
  'g',
);

const AN_QALA_INTRO = new RegExp(
  `(?:^|[\\s،,])عن\\s+(${PERSON})${HONORIFIC}\\s+(?:قال|يقول|قالت)\\s*([:：]|«|"|”|„)`,
  'g',
);

const SAYS_INTRO = new RegExp(
  `(?:^|[\\s،,])سمعت\\s+(${PERSON})${HONORIFIC}\\s+يقول\\s*([:：]|«|"|”|„)?`,
  'g',
);

interface QuoteHit {
  speakerRaw: string;
  sayingStart: number;
  index: number;
}

function cleanSpeaker(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\s+(?:رضي الله عنه|رضي الله عنها|رحمه الله|رحمها الله)\s*$/g, '')
    .trim();
}

function findQuoteHits(text: string): QuoteHit[] {
  const folded = foldArabic(text);
  const hits: QuoteHit[] = [];

  const collect = (pattern: RegExp, speakerGroup: number) => {
    pattern.lastIndex = 0;
    for (const match of folded.matchAll(pattern)) {
      const name = cleanSpeaker(match[speakerGroup] ?? '');
      if (name.length < 2) continue;
      if (/رسول الله|النبي|نبي الله/.test(name)) continue;
      const full = match[0] ?? '';
      const sayingStart = (match.index ?? 0) + full.length;
      hits.push({ speakerRaw: name, sayingStart, index: match.index ?? 0 });
    }
  };

  collect(QUOTE_INTRO, 1);
  collect(AN_QALA_INTRO, 1);

  // «سمعت وهب بن منبه يقول: …»
  SAYS_INTRO.lastIndex = 0;
  for (const match of folded.matchAll(SAYS_INTRO)) {
    const name = cleanSpeaker(match[1] ?? '');
    if (name.length < 2) continue;
    if (/رسول الله|النبي|نبي الله/.test(name)) continue;
    const full = match[0] ?? '';
    let sayingStart = (match.index ?? 0) + full.length;
    // If no delimiter, saying starts after «يقول»
    hits.push({ speakerRaw: name, sayingStart, index: match.index ?? 0 });
  }

  return hits;
}

/** Map folded offsets back roughly by using folded text as working copy. */
function extractSaying(folded: string, start: number): string {
  let saying = folded.slice(start).trim();
  // Drop a leading leftover delimiter.
  saying = saying.replace(/^[:：«"”„]\s*/, '');
  // Stop at a following narrator stamp that is clearly a new report.
  const cut = saying.search(
    /\s(?:حدثنا|حدثني|اخبرنا|اخبرني|انا\s+[ا-ي]|ثنا\s+[ا-ي])\s/,
  );
  if (cut > 40) saying = saying.slice(0, cut).trim();
  return saying;
}

function isEmptySaying(saying: string): boolean {
  const stripped = saying
    .replace(/[«»"“”„:：،,.ـ_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return arabicLetters(stripped) < 12;
}

/** Chain that ends with «عن فلان» / «عن فلان قال» and no quote body. */
function isChainOnly(folded: string): boolean {
  if (/عن\s+[\u0600-\u06FF\s]{2,40}(?:قال|يقول|قالت)?\s*$/.test(folded) && !/[:：«"]/.test(folded)) {
    return true;
  }
  // «قال الحسن» / «عن الحسن، قال» with nothing after.
  if (/(?:قال|يقول|قالت)\s+[\u0600-\u06FF\s]{2,40}$/.test(folded) && arabicLetters(folded) < 80) {
    const hits = findQuoteHits(folded + '«x»'); // force pattern? better:
    void hits;
  }
  if (
    /(?:^|[\s،,])(?:قال|يقول|قالت)\s+[\u0600-\u06FF][\u0600-\u06FF\s]{1,40}$/.test(folded) &&
    !/[:：«"]/.test(folded)
  ) {
    return true;
  }
  return false;
}

function isMarfu(folded: string): boolean {
  for (const cue of MARFU_CUES) {
    if (cue.test(folded)) return true;
  }
  return false;
}

export function classifyNarration(text: string): AtharClassification {
  const stripped = stripOcrNoise(text.replace(/\s+/g, ' ').trim());
  if (!stripped) return { kind: 'REJECT', speakerRaw: null, saying: null };

  if (OCR_RESIDUAL.test(stripped)) {
    return { kind: 'REJECT', speakerRaw: null, saying: null };
  }

  const folded = foldArabic(stripped);
  if (!folded) return { kind: 'REJECT', speakerRaw: null, saying: null };

  if (isMarfu(folded)) {
    return { kind: 'MARFU', speakerRaw: null, saying: null };
  }

  if (isChainOnly(folded)) {
    return { kind: 'REJECT', speakerRaw: null, saying: null };
  }

  const hits = findQuoteHits(folded);
  if (hits.length === 0) {
    // No «قال فلان:» quote frame — not a publishable athar.
    return { kind: 'REJECT', speakerRaw: null, saying: null };
  }

  // Last introducer wins (the person whose words follow).
  hits.sort((a, b) => a.index - b.index);
  const last = hits[hits.length - 1]!;
  const saying = extractSaying(folded, last.sayingStart);

  if (isEmptySaying(saying)) {
    return { kind: 'REJECT', speakerRaw: null, saying: null };
  }

  // Prophetic content inside the saying still → MARFU.
  if (isMarfu(saying) || new RegExp(PROPHET_NAME).test(saying)) {
    // Mention of the Prophet in the attributed speech of a Companion about him
    // (e.g. عائشة: كان أحب العمل إلى رسول الله) stays ATHAR only when the
    // introducer is not a marfu cue and the saying is ABOUT him, not FROM him.
    // Audit rule: explicit prophetic attribution cues already caught; bare
    // «رسول الله» in a Companion's reflection is allowed as ATHAR.
    if (
      /قال\s+(?:رسول الله|النبي)|عن\s+(?:رسول الله|النبي)|سمعت\s+(?:رسول الله|النبي)|رفعه|يرفعه|مرفوعا/.test(
        saying,
      )
    ) {
      return { kind: 'MARFU', speakerRaw: null, saying: null };
    }
  }

  return {
    kind: 'ATHAR',
    speakerRaw: last.speakerRaw,
    saying,
  };
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
      // Prefer formCore ⊆ core (speaker contains the form), not reverse —
      // so «الحسن بن الحر» does not match form «الحسن» via core.includes(formCore)
      // when we require the form to be the head of the speaker name.
      const hit =
        folded === ff ||
        core === formCore ||
        (formCore.length >= 3 && (core === formCore || core.startsWith(`${formCore} `) || core.endsWith(` ${formCore}`)));
      // Also allow short kunya/shuhra exact containment when lengths are close.
      const loose =
        formCore.length >= 4 &&
        core.length >= formCore.length &&
        (core.includes(formCore) && formCore.length / core.length >= 0.5);
      if (!hit && !loose) continue;
      const score = Math.max(
        folded === ff ? ff.length + 2 : 0,
        core === formCore ? formCore.length + 2 : 0,
        hit || loose ? formCore.length : 0,
      );
      if (score > bestLen) {
        bestLen = score;
        best = { key: entry.key, ar: entry.ar };
      }
    }
  }
  return best;
}
