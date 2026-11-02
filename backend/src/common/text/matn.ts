/**
 * Splits a narration into isnad and matn at the last transmission phrase
 * before the Prophet's words (قال رسول الله / أن النبي / سمعت النبي …).
 * Tashkeel is ignored while searching; the returned slices keep the original text.
 */

const MARKS = /[\u064B-\u0652\u0670\u06D6-\u06ED]/;

function foldChar(ch: string): string {
  if (MARKS.test(ch) || ch === '\u0640') return '';
  if (ch === '\u0623' || ch === '\u0625' || ch === '\u0622' || ch === '\u0671') return '\u0627';
  if (ch === '\u0649') return '\u064A';
  if (ch === '\u0629') return '\u0647';
  return ch;
}

function foldWithMap(input: string): { text: string; map: number[] } {
  let text = '';
  const map: number[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const folded = foldChar(input[index] ?? '');
    for (const ch of folded) {
      text += ch;
      map.push(index);
    }
  }
  return { text, map };
}

/** Arabic letters are not `\\w`: these stand in for word boundaries (letters only, so «قال،» still ends a word). */
const LETTER = '[\\u0621-\\u064A\\u066E-\\u06D3]';
const WORD_START = `(?<!${LETTER})`;
const WORD_END = `(?!${LETTER})`;
const NAME = `(?:رسول\\s+الله|النبي|نبي\\s+الله)${WORD_END}`;
/** Plain, bracketed «(صلى الله عليه وسلم)», or the ligature ﷺ. */
const SALAWAT =
  `(?:[(\\[]\\s*)?(?:صلي\\s+الله\\s+عليه(?:\\s+و(?:اله\\s+)?سلم)?|عليه\\s+الصلاه\\s+والسلام|\\uFDFA)${WORD_END}(?:\\s*[)\\]])?`;
/** A word boundary after the verb, so «قالا» / «قالت» never lose their last letter. */
const SPEECH = `(?:انه\\s+قال|قال|يقول|تقول)${WORD_END}`;
/** «فقالوا يا رسول الله» and «وسألت النبي» carry a prefix; the lead itself is a whole word. */
const LEAD = `${WORD_START}(?:[فو])?(?:سمعت|سمعنا|سال|سالت|سالوا|قالت|يقول|تقول|قالوا|قال|قلت|عن|ان)${WORD_END}`;
/** A transmitter introducing the Prophet, then the speech verb when it is there. */
const CUE = new RegExp(
  `${LEAD}\\s+(?:يا\\s+)?${NAME}(?:\\s+${SALAWAT})?(?:\\s+${SPEECH})?`,
  'g',
);
/** «سأل النبي … قال» puts the speech verb after the question, not on the name. */
const PROPHETIC = new RegExp(`${WORD_START}(?:يا\\s+)?${NAME}(?:\\s+${SALAWAT})?\\s+${SPEECH}`, 'g');
/** Arabic letters are not `\w`, so a word boundary cannot be used here. */
const TRANSMISSION = /^(?:و)?(?:حدثنا|حدثني|اخبرنا|اخبرني|انبانا|انباني)(?![\u0600-\u06FF])/;

const MIN_MATN_LETTERS = 8;

function letterCount(value: string): number {
  return (value.match(/[\u0600-\u06FF]/g) ?? []).length;
}

export interface MatnSplit {
  isnadText: string;
  matnText: string;
}

/**
 * Returns the matn after the last usable transmission phrase.
 * A phrase whose remainder is shorter than a real matn is skipped, so a
 * trailing «بمثله» does not eat the narration.
 */
/** Footnote marks such as «\ 1 \» are not part of the narration. */
export function stripFootnotes(value: string): string {
  return value.replace(/\\+\s*\d+\s*\\+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sliceAt(trimmed: string, map: readonly number[], foldedEnd: number): MatnSplit {
  const origin = foldedEnd >= map.length ? trimmed.length : (map[foldedEnd] ?? trimmed.length);
  const matnText = stripFootnotes(trimmed.slice(origin).replace(/^[\s:：،,.\-–—]+/, ''));
  return { isnadText: stripFootnotes(trimmed.slice(0, origin)), matnText };
}

function usable(split: MatnSplit): boolean {
  return letterCount(split.matnText) >= MIN_MATN_LETTERS && !TRANSMISSION.test(foldWithMap(split.matnText).text);
}

export function splitMatn(narration: string): MatnSplit {
  const trimmed = stripFootnotes(narration.trim());
  const { text, map } = foldWithMap(trimmed);
  const ends: number[] = [];
  for (const pattern of [CUE, PROPHETIC]) {
    for (const match of text.matchAll(pattern)) {
      ends.push((match.index ?? 0) + match[0].length);
    }
  }
  ends.sort((a, b) => b - a);
  for (const foldedEnd of ends) {
    const split = sliceAt(trimmed, map, foldedEnd);
    if (usable(split)) return split;
  }
  const continues = /^(?:و)?(?:حدثنا|حدثني|اخبرنا|اخبرني|انبانا|انباني|سمعت|عن)(?![\u0600-\u06FF])/;
  for (const match of text.matchAll(/(?<![\u0621-\u064A])(?:فقالت|فقالوا|فقالا|فقال|وقالت|وقالوا|وقال|فيقول|قالت|قالوا|قالا|يقول|تقول|قال)(?![\u0621-\u064A])/g)) {
    const after = text.slice((match.index ?? 0) + match[0].length).replace(/^[\s:،,."«»]+/, '');
    if (continues.test(after)) continue;
    const split = sliceAt(trimmed, map, (match.index ?? 0) + match[0].length);
    if (usable(split)) return split;
  }
  if (TRANSMISSION.test(text)) {
    const quoteAt = text.search(/[«"']/);
    if (quoteAt > 0) {
      const split = sliceAt(trimmed, map, quoteAt);
      if (usable(split)) return split;
    }
  }
  return { isnadText: '', matnText: trimmed };
}

/* ------------------------------------------------------------------------------------------------
 * Display text with its context (owner decision 2026-11-01).
 *
 * splitMatn cuts at the LAST mention of the Prophet ﷺ, which is right for matching (normalizedMatn) but
 * drops the subject, the question or the whole story when the Prophet ﷺ is named more than once
 * («عن جابر أن رسول الله ﷺ رأى امرأة …» became «رأى امرأة …»). The reader's text starts instead at the
 * last narrator link before the FIRST mention of the Prophet ﷺ, literally from the source, without the
 * rest of the chain: «عن جابر أن رسول الله ﷺ رأى امرأة …».
 * ---------------------------------------------------------------------------------------------- */

/**
 * A context text longer than this (in words) keeps splitMatn's cut for now: the long stories (hundreds of
 * words: al-Hudaybiya, al-Isra', Abu Dharr) wait for review (owner decision 2026-11-01). From the audit of
 * the 5,820 high/medium rows: the median context text is 50 words, the 95th percentile 177, the 98th 269;
 * 230 rows are longer than 200. Published texts shown today reach 112 words at the 95th percentile.
 */
export const CONTEXT_MAX_WORDS = 200;

interface Token {
  start: number;
  /** Without tashkeel, hamza kept: «إن» is not «أن». */
  raw: string;
  folded: string;
}

function foldToken(word: string): string {
  let out = '';
  for (const ch of word) out += foldChar(ch);
  return out
    .replace(/\u0626/g, '\u064A')
    .replace(/\u0624/g, '\u0648')
    .replace(/[^\u0621-\u064A0-9]/g, '');
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    tokens.push({ start: match.index ?? 0, raw: match[0].replace(/[\u064B-\u0652\u0670\u0640]/g, ''), folded: foldToken(match[0]) });
  }
  return tokens;
}

const PROPHET_WORDS = new Set(['رسول', 'النبي', 'نبي', 'للنبي', 'لرسول', 'بالنبي', 'برسول']);
/** «حدثنا فلان»: the text starts at the name, not at the verb. */
const CHAIN_VERBS = new Set([
  'حدثنا', 'حدثني', 'اخبرنا', 'اخبرني', 'انبانا', 'انباني', 'وحدثنا', 'وحدثني', 'واخبرنا', 'واخبرني',
  'حدثناه', 'وحدثناه', 'حدثنيه', 'وحدثنيه', 'اخبرناه', 'واخبرناه', 'ثنا', 'نا',
]);
const HEARD = new Set(['سمعت', 'سمعنا', 'سمع']);
const ABOUT = new Set(['عن', 'وعن', ...HEARD]);
const THAT = new Set(['ان', 'وان']);
/** Words that end a narrator's name: the next link, «قال», «رضي الله عنه», «زوج النبي». */
const NAME_END = new Set([
  'قال', 'قالت', 'يقول', 'تقول', 'ان', 'انه', 'انها', 'عن', 'رضي', 'حدثه', 'اخبره', 'يحدث', 'يحدثه', 'سمع',
  'سمعت', 'قالا', 'قالوا', 'حدثهم', 'يخبر', 'وهو', 'زوج', 'انهم', 'انهما',
]);
/** After «أن فلانًا» a narrator is followed by a report verb; a story is not. */
const REPORTS = new Set([
  'قال', 'قالت', 'يقول', 'تقول', 'اخبره', 'حدثه', 'اخبرهم', 'حدثهم', 'اخبرني', 'حدثني', 'سمع', 'قالا', 'يحدث',
  'اخبرته', 'حدثته', 'كان', 'كانت',
]);
const OBEISANCE = new Set(['رضي', 'الله', 'عنه', 'عنها', 'عنهما', 'عنهم']);
/** Words after a link verb that are not a narrator. */
const NOT_NAMES = new Set([
  'في', 'قال', 'لا', 'ان', 'ما', 'ثم', 'فقال', 'انه', 'من', 'لم', 'اذا', 'يا', 'رجل', 'رجلا', 'رجالا', 'امراه',
  'ناسا', 'اناسا', 'قوما', 'اعرابيا', 'اهل', 'عند', 'مع', 'قد', 'غير', 'هو', 'هي', 'ذلك', 'هذا', 'هذه', 'شيء', 'شي',
  'امر', 'حديث', 'قول', 'الصلاه', 'نفسه', 'نفسي', 'بعض', 'قوله', 'كان', 'كانت', 'كنا', 'كنت', 'نحن', 'انا',
  // An unnamed relative («عن أبيه»، «أن أباه») is no start for a reader: the link before it names him.
  'ابيه', 'اباه', 'ابوه', 'امه', 'جده', 'جدته', 'عمه', 'خاله', 'اخيه', 'اخاه', 'اخوه', 'ابنه', 'مولاه',
]);
/** After «عن» a word with the article is a narrator only when a name or a report follows it at once. */
const AFTER_ARTICLE_NAME = new Set([
  'بن', 'ابن', 'رضي', 'قال', 'قالت', 'يقول', 'عن', 'ان', 'انه', 'انها', 'حدثه', 'اخبره', 'سمع', 'سمعت', 'يحدث',
]);

/** Index of the word that ends a name starting at `from`, or -1 when none comes within `span` words. */
function nameEnd(folded: readonly string[], from: number, span: number): number {
  for (let index = from; index < folded.length && index - from < span; index += 1) {
    if (NAME_END.has(folded[index] ?? '')) return index;
  }
  return -1;
}

/** A question mark, a full stop or a quotation inside a name means it is a sentence, not a narrator. */
const SENTENCE_MARK = /[؟?!«»"“”]|\.$/;

function plainName(raws: readonly string[], from: number, to: number): boolean {
  return raws.length === 0 || !raws.slice(from, to).some((raw) => SENTENCE_MARK.test(raw));
}

/** A transmission word followed by a narrator's name. `raws` are the unfolded words (hamza kept). */
function isNarratorLink(folded: readonly string[], index: number, raws: readonly string[] = []): boolean {
  const word = folded[index] ?? '';
  const next = folded[index + 1] ?? '';
  if (!next || PROPHET_WORDS.has(next) || NOT_NAMES.has(next)) return false;
  if (CHAIN_VERBS.has(word)) return true;
  if (ABOUT.has(word)) {
    if (next.startsWith('ال') && !AFTER_ARTICLE_NAME.has(folded[index + 2] ?? '')) return false;
    const end = nameEnd(folded, index + 2, 6);
    return end >= 0 && plainName(raws, index + 1, end);
  }
  if (THAT.has(word)) {
    // «إن» folds to «ان» but never introduces a narrator.
    if (/^و?إ/.test(raws[index] ?? '')) return false;
    const end = nameEnd(folded, index + 2, 5);
    if (end < 0 || !plainName(raws, index + 1, end)) return false;
    let after = end;
    while (after < folded.length && OBEISANCE.has(folded[after] ?? '')) after += 1;
    return REPORTS.has(folded[after] ?? '');
  }
  return false;
}

/** «ح» (taḥwīl) or a «وحدثنا» starts a second chain; the reader's lead comes from the last one. */
function opensChain(folded: readonly string[], index: number): boolean {
  const word = folded[index] ?? '';
  return CHAIN_VERBS.has(word) && index > 0 && (folded[index - 1] === 'ح' || word.startsWith('و'));
}

/**
 * What lies between splitMatn's early cut and a later start is chain, not matn: it opens with a link within
 * three words, and no run of more than eight words without a link or a name ending (a story) is skipped.
 */
function skipsOnlyChain(span: string): boolean {
  const tokens = tokenize(span).filter((token) => token.folded);
  const folded = tokens.map((token) => token.folded);
  const raws = tokens.map((token) => token.raw);
  if (folded.length === 0) return true;
  let gap = 0;
  let first = -1;
  for (let index = 0; index < folded.length; index += 1) {
    const word = folded[index] ?? '';
    const chain = word === 'ح' || CHAIN_VERBS.has(word) || isNarratorLink(folded, index, raws);
    if (chain && first < 0) first = index;
    gap = chain || NAME_END.has(word) ? 0 : gap + 1;
    if (gap > 8) return false;
  }
  return first >= 0 && first <= 3;
}

/**
 * Where the reader's text starts, as an offset into `text`, or null when no narrator link is found.
 * `matnAt` is where splitMatn's matn starts. A start after it is taken only when the words skipped are chain
 * (splitMatn found no cue and cut at an early «قال»), so no word of the matn is ever dropped.
 */
function contextStart(text: string, matnAt: number): number | null {
  const tokens = tokenize(text);
  const folded = tokens.map((token) => token.folded);
  const raws = tokens.map((token) => token.raw);
  const after = (index: number): boolean => {
    const offset = tokens[index]?.start ?? text.length;
    return offset <= matnAt || skipsOnlyChain(text.slice(matnAt, offset));
  };
  const firstMention = folded.findIndex((word) => PROPHET_WORDS.has(word));
  const matnToken = tokens.findIndex((token) => token.start >= matnAt);
  // A second chain («ح وحدثنا …») may follow the first mention; splitMatn's cut comes after it.
  const chainsEnd = firstMention >= 0 ? Math.max(firstMention, matnToken < 0 ? 0 : matnToken) : folded.length;
  let from = 0;
  for (let index = 1; index < chainsEnd; index += 1) {
    if (opensChain(folded, index) && after(index)) from = index;
  }
  const mention = folded.findIndex((word, index) => index >= from && PROPHET_WORDS.has(word));
  // No mention of the Prophet ﷺ (a Companion's report): the last link before the matn.
  const limit = mention >= 0 ? mention : folded.length;
  const links: number[] = [];
  for (let index = from; index < limit; index += 1) {
    if (isNarratorLink(folded, index, raws)) links.push(index);
  }
  for (let last = links.length - 1; last >= 0; last -= 1) {
    let at = last;
    // «سمعت أبا هريرة» would start with an accusative name: start at the link before it.
    while (HEARD.has(folded[links[at] ?? 0] ?? '') && at > 0) at -= 1;
    let start = links[at] ?? 0;
    if (CHAIN_VERBS.has(folded[start] ?? '')) start += 1;
    if (start < tokens.length && after(start)) return tokens[start]?.start ?? null;
  }
  return null;
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

/**
 * The narration from its last narrator link before the first mention of the Prophet ﷺ to the end
 * («عن جابر أن رسول الله ﷺ رأى امرأة …»). Falls back to splitMatn when no such link is found; never skips a
 * word of splitMatn's matn that is not chain.
 */
export function contextMatn(narration: string): string {
  const trimmed = stripFootnotes(narration.trim());
  const split = splitMatn(trimmed);
  const matnAt = split.isnadText ? Math.max(0, trimmed.lastIndexOf(split.matnText)) : trimmed.length;
  const start = contextStart(trimmed, matnAt);
  if (start === null) return split.matnText;
  const context = trimmed.slice(start).replace(/^[\s:：،,.\-–—]+/, '').trim();
  if (!usable({ isnadText: '', matnText: context })) return split.matnText;
  return context;
}

/**
 * The text a reader sees: contextMatn, unless it is longer than CONTEXT_MAX_WORDS. Those long stories
 * (al-Hudaybiya, al-Isra', …) keep splitMatn's cut until they are reviewed.
 */
export function displayMatn(narration: string): string {
  const context = contextMatn(narration);
  if (wordCount(context) > CONTEXT_MAX_WORDS) return splitMatn(narration).matnText;
  return context;
}

/** Fragments an old split left at the start of a stored matn («قال|ا»، «فقال|وا»، «فقال|ت»). */
const CUT_SUFFIX = /^(?:ا|وا|ت|ن|ون|ي)(?![\u0621-\u064A])/;

/**
 * Rejoins a stored isnad and matn into the narration. A split made before the word-boundary fix could cut
 * inside a word (isnad «… فقال», matn «ت: …»); those halves are glued back without a space.
 */
export function joinNarration(isnadText: string, matnText: string): string {
  const isnad = isnadText.trim();
  const matn = matnText.trim();
  if (!isnad) return matn;
  if (!matn) return isnad;
  const lastWord = foldToken(isnad.split(/\s+/).at(-1) ?? '');
  if (/(?:قال|يقول|تقول)$/.test(lastWord) && CUT_SUFFIX.test(foldWithMap(matn).text)) return `${isnad}${matn}`;
  return `${isnad} ${matn}`;
}

/** Words that open a matn, never a narrator's name. */
const NOT_A_LEAD = new Set([
  'كان', 'كانت', 'قال', 'قالت', 'يقول', 'تقول', 'صلي', 'ثم', 'فقال', 'وقال', 'اذا', 'لما', 'بينما', 'بينا', 'روينا', 'وروينا',
]);
const SPEECH_VERBS = new Set(['يقول', 'تقول', 'يكون']);
const LEAD_REPORTS = new Set([...REPORTS, 'ان', 'انه', 'انها', 'انهم', 'انهما', 'عن', 'سمعت', 'سمعنا', 'سمعا', 'يقول']);

/**
 * The text opens with a narrator lead as contextMatn writes it: «عن جابر …», «أن ابن عمر أخبرهم …», or a
 * name followed by its report («أبو بردة قال …», «الزهري، سمعت عروة …»).
 */
export function startsWithNarratorLead(text: string): boolean {
  const tokens = tokenize(stripFootnotes(text.trim())).filter((token) => token.folded);
  const folded = tokens.map((token) => token.folded);
  const raws = tokens.map((token) => token.raw);
  const first = folded[0] ?? '';
  if (folded.length < 3 || /^[«"“(\[{﴿]/.test(raws[0] ?? '')) return false;
  if (ABOUT.has(first)) return !PROPHET_WORDS.has(folded[1] ?? '');
  if (THAT.has(first)) return isNarratorLink(folded, 0, raws);
  if (CHAIN_VERBS.has(first) || PROPHET_WORDS.has(first) || NOT_NAMES.has(first) || NOT_A_LEAD.has(first)) return false;
  // A name (with its lineage) and then its report; a question or a quotation before it is a matn.
  for (let index = 1; index < Math.min(folded.length, 10); index += 1) {
    if (SENTENCE_MARK.test(raws[index - 1] ?? '') || PROPHET_WORDS.has(folded[index] ?? '')) return false;
    const word = folded[index] ?? '';
    // «يكثر أن يقول …» is a matn: «أن» before a verb is no report.
    if (LEAD_REPORTS.has(word)) return !(word.startsWith('ان') && SPEECH_VERBS.has(folded[index + 1] ?? ''));
  }
  return false;
}

/**
 * The matn used for matching (normalizedMatn, takhrij): always splitMatn's cut, so a stored display text
 * that carries its narrator lead is compared on the same words as before.
 */
export function matnForMatching(row: { textAr: string; matnAr?: string | null }): string {
  const stored = row.matnAr?.trim();
  if (stored) {
    if (!startsWithNarratorLead(stored)) return stored;
    return splitMatn(stored).matnText || stored;
  }
  return splitMatn(row.textAr).matnText || row.textAr;
}
