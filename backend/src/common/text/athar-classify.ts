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
    // ASCII and Arabic-Indic digits (footnote marks like «( ٢٥٧ )»)
    .replace(/(?:^|\s)[\d\u0660-\u0669]{1,4}(?:\s|$)/g, ' ')
    .replace(/\(\s*[\d\u0660-\u0669]+\s*\)/g, ' ')
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
  // «خليلي صلى الله عليه وسلم» / «حبي صلى الله عليه وسلم» / «أصحاب محمد صلى الله عليه وسلم»
  /صلي\s+الله\s+عليه(?:\s+و(?:اله\s+)?سلم)?/,
  /عليه\s+الصلاه\s+والسلام/,
  // حكم الرفع: a Companion's «نهينا» / «أمرنا» / «من السنة» is the Prophet's ruling.
  new RegExp(`${EDGE}[وف]?نهينا${EDGE_END}`),
  new RegExp(`${EDGE}[وف]?امرنا${EDGE_END}`),
  new RegExp(`${EDGE}[وف]?امر\\s+الناس${EDGE_END}`),
  /كنا\s+ن(?:ؤمر|ومر)/,
  /كنا\s+ننهي/,
  /من\s+السنه/,
];

/**
 * A person name in an isnad/quote frame: no commas / semicolons (Arabic أو لاتينية).
 * e.g. ميمون بن ابي شبيب، الحسن، عمر بن الخطاب، عبد الله
 * Extra tokens require بن/ابن/بنت, or a plain name word that is not the
 * preposition «لـ» (قال حذيفة لسلمان — speaker is حذيفة only).
 */
// Block particles / verbs that are not part of a person name.
const NAME_CHUNK = '(?!ل|عن|ان|قال|يقول|قالت|سمعت|ثنا|انا)[^\\s،,؛:：«»"\\[\\]|]+';
const PERSON =
  `(?:ال|ابن|ابي|أبو|ام)?${NAME_CHUNK}` +
  `(?:\\s+(?:بن|ابن|بنت)\\s+(?:ال|ابي|أبو|ام)?${NAME_CHUNK}|\\s+(?:ال|ابي|أبو|ام)?${NAME_CHUNK}){0,5}`;

/** رضي الله عنه / رحمها الله between the name and قال (after foldArabic). */
const HONORIFIC =
  '(?:\\s+رضي\\s+الله\\s+عن[هها]|\\s+رضي\\s+الله\\s+عنهم|\\s+رحمه\\s+الله|\\s+رحمها\\s+الله|\\s+رضوان\\s+الله\\s+عليه)?';

/**
 * Quote introducer: «قال فلان:» / «فقال فلان:» / «عن فلان قال:».
 * Also «أن أبا بكر قال لعمر:» (speaker = أبو بكر, not عمر).
 * Must have a quote delimiter — never a bare isnad «قال».
 */
const QALA = 'ف?(?:قال|يقول|قالت)';
const QUOTE_INTRO = new RegExp(
  `(?:^|[\\s،,])(?:${QALA})\\s+(${PERSON})${HONORIFIC}(?:\\s+ل(?:ـ)?${PERSON})?\\s*([:：]|«|"|”|„)`,
  'g',
);

/** «أن أبا بكر قال لعمر بن الخطاب: …» — speaker is أبو بكر. */
const SAID_TO_INTRO = new RegExp(
  `(?:^|[\\s،,])ان\\s+(${PERSON})${HONORIFIC}\\s+${QALA}\\s+ل(?:ـ)?${PERSON}\\s*([:：]|«|"|”|„)`,
  'g',
);

const AN_QALA_INTRO = new RegExp(
  `(?:^|[\\s،,])عن\\s+(${PERSON})${HONORIFIC}\\s*(?:،|,)?\\s*${QALA}\\s*([:：]|«|"|”|„)`,
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
    .replace(/[،,؛]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^ل+/, '')
    .replace(/\s+(?:رضي الله عنه|رضي الله عنها|رحمه الله|رحمها الله|رضوان الله عليه)\s*$/g, '')
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
  collect(SAID_TO_INTRO, 1);
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

/** After «قال فلان:» the next token is another isnad stamp — no real saying. */
function isIsnadContinuation(saying: string): boolean {
  // No JS `\b` on Arabic — anchor on whitespace / end.
  return /^(?:و)?(?:حدثنا|حدثني|اخبرنا|اخبرني|انا|ثنا)(?:\s|$)/.test(saying.trim());
}

/**
 * Bare short ism («علي»، «عمر») when the chain already has «علي بن عثام» etc.
 * — that قال علي is the transmitter, not the Companion.
 */
function isAmbiguousShortSpeaker(speakerRaw: string, folded: string, hitIndex: number): boolean {
  const core = foldArabic(speakerRaw);
  if (/\s/.test(core)) return false;
  if (!/^(علي|عمر|حسن|انس|مجاهد|قتاده)$/.test(core)) return false;
  const before = folded.slice(0, hitIndex);
  const foreignNasab = new RegExp(
    `${core}\\s+بن\\s+(?!ابي\\s+طالب|ابي\\s+طالب|الخطاب|مالك|جبر|دعامه)`,
  );
  return foreignNasab.test(before);
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
  // Explicit Prophet mention anywhere → prophetic report (audit: none stay ATHAR).
  if (new RegExp(PROPHET_NAME).test(folded)) return true;
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

  // Among real sayings, prefer the last that is ≥ half the longest (so
  // «سمعت وهب يقول:…» beats an earlier «عن محمد قال: سمعت وهب…», while a
  // short late gloss «قال ابن عمر: فقال كعب…» loses to the long كعب matn).
  hits.sort((a, b) => a.index - b.index);
  const viable: Array<{ hit: QuoteHit; saying: string }> = [];
  for (const hit of hits) {
    if (isAmbiguousShortSpeaker(hit.speakerRaw, folded, hit.index)) continue;
    const candidate = extractSaying(folded, hit.sayingStart);
    if (isEmptySaying(candidate) || isIsnadContinuation(candidate)) continue;
    viable.push({ hit, saying: candidate });
  }

  if (viable.length === 0) {
    return { kind: 'REJECT', speakerRaw: null, saying: null };
  }

  const maxLen = Math.max(...viable.map((v) => v.saying.length));
  const threshold = Math.max(40, Math.floor(maxLen * 0.5));
  let chosen = viable[0]!;
  for (let i = viable.length - 1; i >= 0; i--) {
    const v = viable[i]!;
    if (v.saying.length >= threshold) {
      chosen = v;
      break;
    }
  }
  const saying = chosen.saying;

  // Saying that still names the Prophet → MARFU (isMarfu on the full text
  // already covered most cases; re-check the saying alone for safety).
  if (isMarfu(saying)) {
    return { kind: 'MARFU', speakerRaw: null, saying: null };
  }

  return {
    kind: 'ATHAR',
    speakerRaw: chosen.hit.speakerRaw,
    saying,
  };
}

export type AtharStoryRejectReason = 'short' | 'frame-only' | 'ocr' | 'mid-dialogue' | 'content';

export type AtharAttributionKind = 'SAID' | 'NARRATED';

export interface AtharStoryKept {
  kept: true;
  text: string;
  speakerRaw: string;
  attribution: AtharAttributionKind;
}

export interface AtharStoryRejected {
  kept: false;
  reason: AtharStoryRejectReason;
  text: null;
  speakerRaw: null;
  attribution: null;
}

export type AtharStoryResult = AtharStoryKept | AtharStoryRejected;

/** Junk that ends the story: a new chain, the author's note, a heading. */
const STORY_CUTS: RegExp[] = [
  /قال\s*[:：]?\s*و(?:حدثنا|حدثني|اخبرنا|اخبرني|انبانا|ثنا)\s/,
  /(?:^|\s)و?(?:حدثنا|حدثني|اخبرنا|اخبرني|انبانا)\s/,
  /هكذا\s+جاء/,
  /هذا\s+اسناد/,
  /(?:^|\s)و?هذا\s+موقوف/,
  /(?:^|\s)و?هذا\s+مرسل/,
  /(?:^|\s)و?هذا\s+منقطع/,
  /(?:^|\s)و?اسناده(?:\s|$)/,
  /(?:^|\s)و?رواه\s/,
  /(?:^|\s)و?روي(?:\s|$)/,
  /اخرج[هة]\s/,
  /فصل\s+في/,
  /(?:^|\s)باب\s+/,
];

const STORY_OCR = /[\[\]{}|~$^]|:\s*:|PageV\d+P\d+|\[\s*\$\s*\]/i;

function foldWithMap(input: string): { folded: string; toOrig: number[] } {
  const chars: string[] = [];
  const rawMap: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/.test(ch)) continue;
    let out = ch;
    if (/[أإآٱ]/.test(ch)) out = 'ا';
    else if (ch === 'ى') out = 'ي';
    else if (ch === 'ة') out = 'ه';
    chars.push(out);
    rawMap.push(i);
  }
  let folded = '';
  const toOrig: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < chars.length; i++) {
    const space = /\s/.test(chars[i]!);
    if (space) {
      if (prevSpace || folded.length === 0) continue;
      folded += ' ';
      toOrig.push(rawMap[i]!);
      prevSpace = true;
      continue;
    }
    folded += chars[i];
    toOrig.push(rawMap[i]!);
    prevSpace = false;
  }
  if (folded.endsWith(' ')) {
    folded = folded.slice(0, -1);
    toOrig.pop();
  }
  return { folded, toOrig };
}

function frameAt(folded: string, matchIndex: number): number {
  const rel = folded.slice(matchIndex).search(/[^\s،,]/);
  return matchIndex + (rel < 0 ? 0 : rel);
}

/** «عن غيلان قال: قال مطرف:» — the first frame only hands off to the speaker. */
function isHandoff(folded: string, hit: QuoteHit, next: QuoteHit): boolean {
  const between = folded.slice(hit.sayingStart, next.index).replace(/[«»"“”„:：\s]/g, '');
  return between.length === 0;
}

function earliestCut(region: string): number {
  let cut = region.length;
  for (const pattern of STORY_CUTS) {
    const at = region.search(pattern);
    if (at >= 0 && at < cut) cut = at;
  }
  return cut;
}

function isOnlyFrame(body: string): boolean {
  const t = body.replace(/[«»"“”„]/g, '').trim();
  if (!t) return true;
  return /^(?:ف?(?:قال|يقول|قالت)|سمعت)\s+\S.{0,50}$/.test(t) && !/[:：]/.test(t);
}

/** «سبحان الله وما له؟ قالت:…» or a dangling «وما يبقى…؟». */
function isMidDialogue(body: string): boolean {
  const t = body.replace(/^[«"\s]+/, '');
  if (/^[^«"]{0,48}[؟?][»"\s]*(?:قالت|قال|فقال|فقالت)\s*[:：]/.test(t)) return true;
  if (/^و(?:ما|هل|اين|كيف)\s+\S/.test(t) && /[؟?]\s*$/.test(t) && t.length < 60) return true;
  return false;
}

function attributionOf(body: string): AtharAttributionKind {
  const t = body.replace(/^[«"\s]+/, '');
  // The frame speaker is only reporting what someone else said or did.
  if (/^(?:دخل|اتي|مر|خرج|جاء|لقي|سالت|سئل|بينما|بينا|قام)\s+/.test(t)) return 'NARRATED';
  if (/^مررنا\s+/.test(t)) return 'NARRATED';
  if (/^رايت\s+(?!ان|ما\s)/.test(t)) return 'NARRATED';
  if (/^(?:ف)?(?:قال|قالت|يقول)\s+(?:لي\s+)?/.test(t)) return 'NARRATED';
  if (/^ما\s+(?:اكل|دخل|كان|قال|خرج|مر|شبع|لبس)\s+/.test(t)) return 'NARRATED';
  if (/^(?:كان|كانت)\s+(?!ي|ت|ن|ربما|الرجل|المؤمن|الانسان|العبد|احد)/.test(t)) {
    return 'NARRATED';
  }
  // The framed speaker only asks, and another person answers.
  if (/^.{0,100}[؟?][،,\s«"]*(?:قال|قالت|فقال|فقالت)\s*[:：]/.test(t)) return 'NARRATED';
  return 'SAID';
}

/** Phrases that keep an athar off the public list (istighatha, Isra'iliyyat). */
const CONTENT_EXCLUSIONS: { label: string; pattern: RegExp }[] = [
  { label: 'أعينوا عباد الله', pattern: /اعينوا\s+عباد\s+الله/ },
  { label: 'يا فلان أغثني', pattern: /يا\s+(?!الله(?:\s|$))[\u0600-\u06FF]+\s+اغثني/ },
  { label: 'العمالقة', pattern: /العمالقه/ },
  { label: 'بني إسرائيل', pattern: /بني\s+اسرائيل/ },
  { label: 'في الكتب الأولى', pattern: /في\s+الكتب\s+الاولي/ },
];

/** Cue that makes the narration unpublishable, or null when it may stay. */
export function atharContentCue(text: string): string | null {
  const folded = foldArabic(text);
  for (const item of CONTENT_EXCLUSIONS) {
    if (item.pattern.test(folded)) return item.label;
  }
  return null;
}

function rejected(reason: AtharStoryRejectReason): AtharStoryRejected {
  return { kept: false, reason, text: null, speakerRaw: null, attribution: null };
}

/**
 * Story text for display: from the first real speaker frame through the
 * narration, stopping before a new chain, an author's note, a heading, or a
 * footnote. Several speakers inside one story stay.
 */
export function extractAtharStory(text: string): AtharStoryResult {
  const cleaned = stripOcrNoise(text.replace(/\s+/g, ' ').trim());
  if (!cleaned) return rejected('short');

  const { folded, toOrig } = foldWithMap(cleaned);
  const hits = findQuoteHits(folded).sort((a, b) => a.index - b.index);
  if (hits.length === 0) return rejected('frame-only');

  let start = hits[0]!;
  for (let i = 0; i < hits.length - 1; i++) {
    const hit = hits[i]!;
    const next = hits[i + 1]!;
    if (!isHandoff(folded, hit, next)) break;
    start = next;
  }

  const origin = frameAt(folded, start.index);
  const region = folded.slice(start.sayingStart);
  const cutRel = earliestCut(region);
  const cutAbs = start.sayingStart + cutRel;
  const origStart = toOrig[origin] ?? 0;
  const origEnd = cutAbs >= folded.length ? cleaned.length : (toOrig[cutAbs] ?? cleaned.length);
  const story = cleaned
    .slice(origStart, origEnd)
    .replace(/[«»"“”„\s]+$/g, '')
    .trim();
  const bodyStart = toOrig[start.sayingStart] ?? origStart;
  const body = cleaned
    .slice(bodyStart, origEnd)
    .replace(/^[«»"“”„:：\s]+/, '')
    .replace(/[«»"“”„\s]+$/g, '')
    .trim();
  const bodyFolded = foldArabic(body);

  if (STORY_OCR.test(story) || STORY_OCR.test(body)) return rejected('ocr');
  if (isOnlyFrame(bodyFolded)) return rejected('frame-only');
  if (body.length < 25) return rejected('short');
  if (isMidDialogue(bodyFolded)) return rejected('mid-dialogue');
  if (atharContentCue(bodyFolded)) return rejected('content');

  return {
    kept: true,
    text: story,
    speakerRaw: start.speakerRaw,
    attribution: attributionOf(bodyFolded),
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
    // أبا بكر / أبي بكر → أبو بكر for YAML matching
    .replace(/^(?:ابا|ابي|ابو)\s+/, 'ابو ')
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
  const coreHasNasab = /(?:^|\s)(?:بن|ابن|بنت)\s/.test(core);
  let best: AtharSpeakerMatch | null = null;
  let bestLen = 0;
  for (const entry of speakers) {
    const entryForms = entry.forms.map((form) => foldArabic(form)).filter(Boolean);
    const entryFull = entryForms.filter((form) => /(?:بن|ابن|بنت)\s/.test(form));
    for (const ff of entryForms) {
      const formCore = coreName(ff);
      if (!ff) continue;
      const formIsShort = !/\s/.test(formCore);
      // Short ism («عمار»، «علي»، «حذيفة») — exact core only. Never claim
      // «عمار بن سعيد», «حذيفة المرعشي», etc. via a bare given name.
      if (formIsShort) {
        if (core !== formCore && folded !== ff) continue;
        if (coreHasNasab) {
          const nasabOk = entryFull.some(
            (full) => core === full || core.startsWith(`${full} `) || full.startsWith(core),
          );
          if (!nasabOk) continue;
        }
      }
      // Extra tokens after a form are only OK when the full core is itself an
      // entry form, or the rest is an honorific — never «أبو سعيد الخراز» →
      // أبو سعيد الخدري, or «أبو بكر الرازي» → أبو بكر الصديق.
      const restAfterForm = core.startsWith(`${formCore} `)
        ? core.slice(formCore.length + 1)
        : '';
      const restIsHonorific = /^(?:رضي|رحم|رضوان)/.test(restAfterForm);
      const coreIsListedForm = entryForms.some((f) => coreName(f) === core);
      const prefixOk =
        !formIsShort &&
        formCore.length >= 3 &&
        restAfterForm.length > 0 &&
        (restIsHonorific || coreIsListedForm);
      const hit =
        folded === ff ||
        core === formCore ||
        prefixOk ||
        (!formIsShort && formCore.length >= 3 && core.endsWith(` ${formCore}`));
      // No fuzzy includes — nisba collisions were too common.
      if (!hit) continue;
      const score = Math.max(
        folded === ff ? ff.length + 2 : 0,
        core === formCore ? formCore.length + 2 : 0,
        hit ? formCore.length : 0,
      );
      if (score > bestLen) {
        bestLen = score;
        best = { key: entry.key, ar: entry.ar };
      }
    }
  }
  return best;
}
