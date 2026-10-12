/**
 * Pure parsers for al-Bukhari, «الأدب المفرد» (ت محمد فؤاد عبد الباقي,
 * OpenITI Shamela0012991) and al-Albani's split «صحيح الأدب المفرد» /
 * «ضعيف الأدب المفرد» (OpenITI Shamela0001341 / Shamela0001346).
 *
 * Albani entries are written «<albaniNo>/<originalNo> (<ruling>) <text>». The
 * original number is trusted only after the entry's text is found in the
 * narration carrying that number (`verifyAlbaniEntries`).
 */
import { HadithGrade } from '@prisma/client';
import { normalizeArabic } from '../../../src/common/text/arabic-normalizer.js';
import { readBlocks, readRecords } from '../lib/openiti.js';

// ── al-Adab al-Mufrad ───────────────────────────────────────────────────────

export interface AdabNarration {
  number: number;
  /** 1 for the first heading with this number, 2 for a repeated number. */
  occurrence: number;
  page: number | null;
  textAr: string;
  chapterTitle: string | null;
  /** First narration number of the chapter: `abdulbaqi:bab@<n>`. */
  chapterKey: string | null;
  /** «[قال الشيخ الألباني]» note printed under the narration in this corpus file. */
  embeddedRuling: string | null;
  line: number;
}

export interface AdabChapter {
  key: string;
  titleAr: string;
  firstNumber: number;
}

export interface AdabParseResult {
  narrations: AdabNarration[];
  chapters: AdabChapter[];
  missingNumbers: number[];
  repeatedNumbers: number[];
}

const NARRATION_HEADING = /^(\d+)\s*-[\s-]*(.*)$/;
const EMBEDDED_RULING_HEADING = /^\[قال الشيخ الألباني\]/;
const CHAPTER_HEADING = /^باب(?:\s|$)/;

export function parseAdabMufrad(source: string): AdabParseResult {
  const narrations: AdabNarration[] = [];
  const chapters: AdabChapter[] = [];
  const occurrences = new Map<number, number>();
  let chapterTitle: string | null = null;
  let pendingChapter: string | null = null;
  let expectRulingFor: AdabNarration | null = null;

  for (const record of readRecords(source)) {
    if (CHAPTER_HEADING.test(record.heading)) {
      // «### | باب » with the title on the next line («# عيادة الصبيان»).
      const title = record.heading.trim() === 'باب' ? `باب ${record.paragraphs[0]?.text ?? ''}` : record.heading;
      chapterTitle = title.trim();
      pendingChapter = chapterTitle;
      continue;
    }
    if (EMBEDDED_RULING_HEADING.test(record.heading)) {
      // The ruling note is inserted mid-record: its first line is the ruling, and any
      // following lines continue the narration (or open a chapter written as a line).
      const [ruling, ...rest] = record.paragraphs;
      let continues = expectRulingFor;
      if (continues) continues.embeddedRuling = ruling?.text ?? null;
      for (const paragraph of rest) {
        if (CHAPTER_HEADING.test(paragraph.text)) {
          chapterTitle = paragraph.text;
          pendingChapter = chapterTitle;
          continues = null;
        } else if (continues) {
          continues.textAr = `${continues.textAr}\n${paragraph.text}`;
        }
      }
      expectRulingFor = null;
      continue;
    }
    const heading = NARRATION_HEADING.exec(record.heading);
    if (!heading) continue;
    const number = Number(heading[1]);
    const occurrence = (occurrences.get(number) ?? 0) + 1;
    occurrences.set(number, occurrence);
    if (pendingChapter) {
      chapters.push({ key: `abdulbaqi:bab@${number}`, titleAr: pendingChapter, firstNumber: number });
      pendingChapter = null;
    }
    const remainder = (heading[2] ?? '').trim();
    const narration: AdabNarration = {
      number,
      occurrence,
      page: record.page,
      textAr: [remainder, record.body].filter(Boolean).join('\n'),
      chapterTitle,
      chapterKey: chapters.at(-1)?.key ?? null,
      embeddedRuling: null,
      line: record.line,
    };
    narrations.push(narration);
    expectRulingFor = narration;
  }

  const seen = new Set(narrations.map((narration) => narration.number));
  const max = Math.max(0, ...seen);
  const missingNumbers: number[] = [];
  for (let number = 1; number <= max; number++) if (!seen.has(number)) missingNumbers.push(number);
  return {
    narrations,
    chapters,
    missingNumbers,
    repeatedNumbers: [...occurrences].filter(([, count]) => count > 1).map(([number]) => number),
  };
}

export function adabExternalId(narration: Pick<AdabNarration, 'number' | 'occurrence'>): string {
  return narration.occurrence === 1 ? `abdulbaqi:${narration.number}` : `abdulbaqi:${narration.number}-${narration.occurrence}`;
}

// ── al-Albani's split ───────────────────────────────────────────────────────

export type AlbaniBook = 'sahih' | 'daif';

export interface AlbaniEntry {
  book: AlbaniBook;
  albaniNumber: number;
  /** Number as cited: «296/1» when al-Albani sub-numbers an entry. */
  albaniLabel: string;
  originalNumber: number;
  /** «م» after the original number (a repeated narration in Abd al-Baqi's numbering). */
  repeatMark: boolean;
  ruling: string | null;
  text: string;
  line: number;
}

export interface AlbaniParseResult {
  entries: AlbaniEntry[];
  /** Lines that open like an entry but whose numbers could not be read. */
  unparsed: Array<{ line: number; text: string }>;
}

/**
 * Entry openings seen in the files:
 *  «12/15 (صحيح) …», «204/270م- (صحيح) …», «296/1/383 (حسن الإسناد) …» (sub-numbered entry),
 *  «187/ (250/1) (صحيح) - …» and «85/ (565/ (ضعيف) 1) - …» (part k of original 250 / 565).
 */
const ENTRY_FORMS: ReadonlyArray<{ pattern: RegExp; read: (match: RegExpExecArray) => EntryNumbers }> = [
  {
    pattern: /^(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s*(م)?\s*-?\s*/,
    read: (m) => ({ albani: Number(m[1]), label: `${m[1]}/${m[2]}`, original: Number(m[3]), repeat: m[4] === 'م', ruling: null }),
  },
  {
    pattern: /^(\d+)\s*\/\s*\(\s*(\d+)\s*\/\s*(?:\(([^()]+)\)\s*)?\d+\s*\)\s*-?\s*/,
    read: (m) => ({ albani: Number(m[1]), label: m[1] ?? '', original: Number(m[2]), repeat: false, ruling: m[3] ?? null }),
  },
  {
    pattern: /^(\d+)\s*\/\s*(\d+)\s*(م)?\s*-?\s*/,
    read: (m) => ({ albani: Number(m[1]), label: m[1] ?? '', original: Number(m[2]), repeat: m[3] === 'م', ruling: null }),
  },
];

interface EntryNumbers {
  albani: number;
  label: string;
  original: number;
  repeat: boolean;
  ruling: string | null;
}

function readEntryStart(text: string): { numbers: EntryNumbers; rest: string } | null {
  for (const form of ENTRY_FORMS) {
    const match = form.pattern.exec(text);
    if (match) {
      const numbers = form.read(match);
      const rest = text.slice(match[0].length);
      return { numbers, rest: numbers.ruling ? `(${numbers.ruling}) ${rest}` : rest };
    }
  }
  return null;
}

const ENTRY_LIKE = /^\d+\s*\//;
const FOOTNOTE_MARKS = /^(?:\s*\(\d+\)\s*)+/;
const BRACKET_RULING = /^\s*\(([^()]+)\)\s*/;
/** A ruling printed without brackets, e.g. «صحيح الإسناد عن ابن عباس …». */
const BARE_RULING = /^(صحيح|حسن|ضعيف|موضوع)(?:\s+(?:الإسناد|لغيره|صحيح|جدا))?(?=\s+(?:عن|قال)\s)/;
const RULING_WORD = /^(?:صحيح|حسن|ضعيف|موضوع|منكر|شاذ|موقوف|مقطوع)/;

export function parseAlbaniSplit(source: string, book: AlbaniBook): AlbaniParseResult {
  const entries: AlbaniEntry[] = [];
  const unparsed: AlbaniParseResult['unparsed'] = [];
  let current: { entry: AlbaniEntry; parts: string[] } | null = null;

  const close = (): void => {
    if (!current) return;
    const { ruling, text } = splitRuling(current.parts.join(' '));
    current.entry.ruling = ruling;
    current.entry.text = text;
    entries.push(current.entry);
    current = null;
  };

  for (const block of readBlocks(source)) {
    const start = readEntryStart(block.text);
    if (start) {
      close();
      current = {
        entry: {
          book,
          albaniNumber: start.numbers.albani,
          albaniLabel: start.numbers.label,
          originalNumber: start.numbers.original,
          repeatMark: start.numbers.repeat,
          ruling: null,
          text: '',
          line: block.line,
        },
        parts: [start.rest],
      };
      continue;
    }
    if (ENTRY_LIKE.test(block.text)) {
      close();
      unparsed.push({ line: block.line, text: block.text.slice(0, 80) });
      continue;
    }
    if (block.kind === 'heading') {
      close();
      continue;
    }
    if (current) current.parts.push(block.text);
  }
  close();
  return { entries, unparsed };
}

function splitRuling(raw: string): { ruling: string | null; text: string } {
  const body = raw.replace(FOOTNOTE_MARKS, '').trim();
  const bracket = BRACKET_RULING.exec(body);
  if (bracket && RULING_WORD.test((bracket[1] ?? '').trim())) {
    return { ruling: (bracket[1] ?? '').trim().replace(/\.$/, ''), text: body.slice(bracket[0].length).trim() };
  }
  const bare = BARE_RULING.exec(body);
  if (bare) return { ruling: bare[0].trim(), text: body.slice(bare[0].length).trim() };
  return { ruling: null, text: body };
}

// ── Grade mapping ───────────────────────────────────────────────────────────

export type GradeBasis = 'ruling' | 'membership' | 'qualified' | 'unrecognised' | 'no-ruling';

/**
 * Per-entry grade. صحيح… → SAHIH, حسن… (incl. «حسن صحيح») → HASAN, ضعيف… / منكر / شاذ → DAIF,
 * موضوع → MAWDU. Qualified rulings in the Sahih book («صحيح دون …», «… إلا …») and
 * entries without a ruling word stay UNGRADED (the book title alone does not tell
 * صحيح from حسن). Every Da'if-book entry is at most DAIF.
 */
export function gradeFromRuling(book: AlbaniBook, ruling: string | null): { grade: HadithGrade; basis: GradeBasis } {
  if (book === 'daif') {
    if (ruling && /^موضوع/.test(ruling)) return { grade: HadithGrade.MAWDU, basis: 'ruling' };
    if (ruling && /^(?:ضعيف|منكر|شاذ)/.test(ruling)) return { grade: HadithGrade.DAIF, basis: 'ruling' };
    return { grade: HadithGrade.DAIF, basis: 'membership' };
  }
  if (!ruling) return { grade: HadithGrade.UNGRADED, basis: 'no-ruling' };
  if (/(?:^|\s)(?:دون|إلا)(?:\s|$)/.test(ruling)) return { grade: HadithGrade.UNGRADED, basis: 'qualified' };
  if (/^صحيح/.test(ruling)) return { grade: HadithGrade.SAHIH, basis: 'ruling' };
  if (/^حسن/.test(ruling)) return { grade: HadithGrade.HASAN, basis: 'ruling' };
  return { grade: HadithGrade.UNGRADED, basis: 'unrecognised' };
}

const ACCEPTED_GRADES: ReadonlySet<HadithGrade> = new Set([HadithGrade.SAHIH, HadithGrade.HASAN]);

/**
 * True when the split's grade and the ruling printed under the narration in the
 * Abd al-Baqi file disagree on acceptance (صحيح/حسن vs ضعيف/موضوع). Such a
 * narration stays UNGRADED; a صحيح/حسن difference is not a dispute.
 */
export function isAcceptanceDispute(grade: HadithGrade, embeddedRuling: string | null): boolean {
  const printed = gradeClassOf(embeddedRuling);
  if (printed === null || grade === HadithGrade.UNGRADED) return false;
  return ACCEPTED_GRADES.has(grade) !== ACCEPTED_GRADES.has(printed);
}

/** Same vocabulary, applied to the ruling printed in the Abd al-Baqi corpus file (cross-check only). */
export function gradeClassOf(ruling: string | null): HadithGrade | null {
  if (!ruling) return null;
  if (/^صحيح/.test(ruling)) return HadithGrade.SAHIH;
  if (/^حسن/.test(ruling)) return HadithGrade.HASAN;
  if (/^(?:ضعيف|منكر|شاذ)/.test(ruling)) return HadithGrade.DAIF;
  if (/^موضوع/.test(ruling)) return HadithGrade.MAWDU;
  return null;
}

// ── Mapping verification ────────────────────────────────────────────────────

const STOP_WORDS = new Set(
  [
    'قال', 'عن', 'الله', 'صلي', 'عليه', 'وسلم', 'رسول', 'النبي', 'ان', 'من', 'في', 'ما', 'لا', 'يا', 'ثم',
    'علي', 'الي', 'او', 'قالت', 'فقال', 'وقال', 'هو', 'له', 'كان', 'اذا', 'ابن', 'ابي', 'بن', 'رضي', 'عنه',
  ].map(normalizeArabic),
);
const SAMPLE_TOKENS = 25;
/** Share of the entry's opening content words that must appear in the matched narration. */
const MATCH_THRESHOLD = 0.6;

function contentTokens(text: string): string[] {
  return normalizeArabic(text)
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

export function overlapScore(entryText: string, narrationText: string): number {
  const sample = contentTokens(entryText).slice(0, SAMPLE_TOKENS);
  if (sample.length === 0) return 0;
  const target = new Set(contentTokens(narrationText));
  return sample.filter((token) => target.has(token)).length / sample.length;
}

export interface VerifiedEntry {
  entry: AlbaniEntry;
  /** externalId of the matched narration, or null when the mapping is not trusted. */
  externalId: string | null;
  score: number;
  neighbourScore: number;
}

export function verifyAlbaniEntries(
  entries: readonly AlbaniEntry[],
  narrations: readonly AdabNarration[],
): VerifiedEntry[] {
  const byNumber = new Map<number, AdabNarration[]>();
  for (const narration of narrations) byNumber.set(narration.number, [...(byNumber.get(narration.number) ?? []), narration]);

  return entries.map((entry) => {
    const candidates = byNumber.get(entry.originalNumber) ?? [];
    let best: { narration: AdabNarration; score: number } | null = null;
    for (const narration of candidates) {
      const score = overlapScore(entry.text, narration.textAr);
      if (!best || score > best.score) best = { narration, score };
    }
    let neighbourScore = 0;
    for (let offset = -2; offset <= 2; offset++) {
      if (offset === 0) continue;
      for (const narration of byNumber.get(entry.originalNumber + offset) ?? []) {
        neighbourScore = Math.max(neighbourScore, overlapScore(entry.text, narration.textAr));
      }
    }
    const score = best?.score ?? 0;
    // Neighbours (±2) may repeat the same report through another isnad: a tie is fine,
    // a better-matching neighbour means the written number is probably a typo.
    const trusted = best !== null && score >= MATCH_THRESHOLD && score >= neighbourScore;
    return { entry, externalId: trusted && best ? adabExternalId(best.narration) : null, score, neighbourScore };
  });
}

export interface ResolvedGrade {
  grade: HadithGrade;
  gradeReference: string | null;
  entries: AlbaniEntry[];
  conflict: boolean;
}

const GRADE_STRENGTH: Record<HadithGrade, number> = {
  [HadithGrade.SAHIH]: 4,
  [HadithGrade.HASAN]: 3,
  [HadithGrade.DAIF]: 2,
  [HadithGrade.MAWDU]: 1,
  [HadithGrade.UNGRADED]: 0,
};

function albaniReference(entry: AlbaniEntry): string {
  return `${entry.book === 'sahih' ? 'صحيح' : 'ضعيف'} الأدب المفرد ${entry.albaniLabel}`;
}

/**
 * Combines the trusted entries that point at one narration. Grades within the
 * same book combine weakest-wins (content-pipeline §2.6); a narration listed in
 * both the Sahih and the Da'if book (al-Albani split it) is a conflict and stays
 * UNGRADED for a curator.
 */
export function resolveGrade(entries: readonly AlbaniEntry[]): ResolvedGrade {
  const books = new Set(entries.map((entry) => entry.book));
  if (books.size > 1) return { grade: HadithGrade.UNGRADED, gradeReference: null, entries: [...entries], conflict: true };
  const graded = entries
    .map((entry) => ({ entry, ...gradeFromRuling(entry.book, entry.ruling) }))
    .filter((item) => item.grade !== HadithGrade.UNGRADED);
  if (graded.length === 0) return { grade: HadithGrade.UNGRADED, gradeReference: null, entries: [...entries], conflict: false };
  const weakest = graded.reduce((low, item) => (GRADE_STRENGTH[item.grade] < GRADE_STRENGTH[low.grade] ? item : low));
  return {
    grade: weakest.grade,
    gradeReference: graded.map((item) => albaniReference(item.entry)).join('، '),
    entries: [...entries],
    conflict: false,
  };
}

// ── Chapter → entity suggestions ────────────────────────────────────────────

export interface NamedEntity {
  id: string;
  kind: 'SIN' | 'GOOD_DEED';
  slug: string;
  nameAr: string;
}

export interface ChapterMatch {
  entity: NamedEntity;
  kind: 'match' | 'near-miss';
}

function nameTokens(text: string): string[] {
  return normalizeArabic(text)
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Drops the article and a leading conjunction, for near-miss detection only. */
function stem(token: string): string {
  return token.replace(/^و(?=ال)/, '').replace(/^ال/, '');
}

/**
 * A chapter title matches an entity when the entity's normalised name occurs in
 * the title as whole consecutive words («باب الكبر» ↔ «الكبر»). Sharing a stem
 * (3+ letters) without matching is a near-miss, listed for the owner only.
 */
export function matchChapterTitle(title: string, entities: readonly NamedEntity[]): ChapterMatch[] {
  const titleTokens = nameTokens(title.replace(/^باب\s*/, ''));
  const titleStems = new Set(titleTokens.map(stem).filter((token) => token.length >= 3));
  const results: ChapterMatch[] = [];
  for (const entity of entities) {
    const target = nameTokens(entity.nameAr);
    if (target.length === 0) continue;
    if (containsSequence(titleTokens, target)) {
      results.push({ entity, kind: 'match' });
    } else if (target.some((token) => titleStems.has(stem(token)))) {
      results.push({ entity, kind: 'near-miss' });
    }
  }
  return results;
}

function containsSequence(haystack: readonly string[], needle: readonly string[]): boolean {
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) return true;
  }
  return false;
}
