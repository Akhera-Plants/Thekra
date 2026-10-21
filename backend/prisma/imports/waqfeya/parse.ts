/**
 * Narration splitters for the Waqfeya OCR editions. Grades come only from an
 * explicit ruling on that narration: Albani's margin word, or one of the three
 * Riyad takhrij phrases. Nothing else is inferred.
 */
import { HadithGrade } from '@prisma/client';
import { stripPageMarkers } from '../../../src/common/text/strip-page-markers.js';
import { foldArabic, splitLeadingGrade, stripInlineGrades } from './clean.js';

export interface ParsedNarration {
  number: number;
  occurrence: number;
  volume: string;
  page: string;
  textAr: string;
  grade: HadithGrade;
  /** Margin word or takhrij phrase that produced the grade. Null when UNGRADED. */
  gradeToken: string | null;
  takhrij: string | null;
  chapterTitle: string | null;
  /** Offsets in the replaced full text, used to attach verse keys. */
  start: number;
  end: number;
}

export interface ParsedChapter {
  key: string;
  titleAr: string;
}

interface PageSlice {
  volume: string;
  page: number;
  text: string;
  start: number;
}

const PAGE_MARKER = /\[\[(\d+):(\d+)\]\]/g;
const NUMBER = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]';

function arabicNumber(raw: string): number | null {
  const normalized = raw
    .replace(/[\u0660-\u0669]/g, (char) => String(char.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (char) => String(char.charCodeAt(0) - 0x06f0));
  if (!/^\d+$/.test(normalized)) return null;
  return Number(normalized);
}

function slicePages(text: string): PageSlice[] {
  const marks = [...text.matchAll(PAGE_MARKER)];
  return marks.map((mark, index) => {
    const start = mark.index + mark[0].length;
    const end = index + 1 < marks.length ? marks[index + 1]!.index : text.length;
    return { volume: mark[1]!, page: Number(mark[2]), text: text.slice(start, end), start };
  });
}

function narrationBody(raw: string): string {
  const lines: string[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^\[\[\d+:\d+\]\]$/.test(trimmed)) continue;
    const grade = splitLeadingGrade(trimmed);
    if (grade) {
      if (grade.rest) lines.push(grade.rest);
      continue;
    }
    lines.push(trimmed);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function arabicLetters(text: string): number {
  return text.match(/[\u0621-\u064A]/g)?.length ?? 0;
}

function chapterKey(title: string): string {
  return foldArabic(title).slice(0, 180);
}

interface GradeEvent {
  kind: 'grade';
  token: string;
  grade: HadithGrade;
}

interface HadithEvent {
  kind: 'hadith';
  number: number;
  offset: number;
}

function gradeOfToken(token: string): HadithGrade {
  if (token === 'حسن' || token === 'حسن لغيره' || token === 'ح لغيره') return HadithGrade.HASAN;
  return HadithGrade.SAHIH;
}

function displayToken(token: string): string {
  if (token === 'ص لغيره') return 'صحيح لغيره';
  if (token === 'ح لغيره') return 'حسن لغيره';
  return token;
}

/**
 * Margin grades sit on their own line, sometimes before the hadith number and
 * sometimes just after it. A grade is attached only on that page.
 */
function assignPageGrades(events: ReadonlyArray<GradeEvent | HadithEvent>): Array<{ grade: HadithGrade; token: string } | null> {
  const assigned: Array<{ grade: HadithGrade; token: string } | null> = [];
  let pending: GradeEvent[] = [];
  let current: number | null = null;
  for (const event of events) {
    if (event.kind === 'grade') {
      if (current !== null && assigned[current] === null && pending.length === 0) assigned[current] = event;
      else pending.push(event);
      continue;
    }
    if (pending.length > 0 && current !== null && assigned[current] === null) assigned[current] = pending.shift() ?? null;
    assigned.push(pending.shift() ?? null);
    current = assigned.length - 1;
  }
  return assigned;
}

function finish(
  drafts: Array<Omit<ParsedNarration, 'occurrence'>>,
): ParsedNarration[] {
  const seen = new Map<string, number>();
  return drafts.map((draft) => {
    const id = `${draft.volume}:${draft.number}`;
    const occurrence = (seen.get(id) ?? 0) + 1;
    seen.set(id, occurrence);
    return { ...draft, occurrence };
  });
}

function collectChapters(narrations: readonly ParsedNarration[]): ParsedChapter[] {
  const seen = new Set<string>();
  const chapters: ParsedChapter[] = [];
  for (const narration of narrations) {
    if (!narration.chapterTitle) continue;
    const key = chapterKey(narration.chapterTitle);
    if (seen.has(key)) continue;
    seen.add(key);
    chapters.push({ key, titleAr: narration.chapterTitle });
  }
  return chapters;
}

function parseNumbered(
  text: string,
  options: {
    startPattern: RegExp;
    acceptNumber: (left: number, right: number | null) => boolean;
    chapterOf: (line: string) => string | null;
    gradeFromBody: (body: string) => { grade: HadithGrade; token: string | null; takhrij: string | null };
    minLetters: number;
    cue?: RegExp;
    /** Albani margin words. Off for books whose grade comes only from the matn. */
    useMarginGrades?: boolean;
    /** Line containing the number, from the number onward. */
    acceptLine?: (line: string) => boolean;
  },
): { narrations: ParsedNarration[]; chapters: ParsedChapter[] } {
  const pages = slicePages(text);
  type Draft = Omit<ParsedNarration, 'occurrence'>;
  const drafts: Draft[] = [];
  let chapterTitle: string | null = null;
  let open: Draft | null = null;

  for (const page of pages) {
    const chapterAt: Array<{ at: number; title: string }> = [];
    const starts: HadithEvent[] = [];
    for (const match of page.text.matchAll(options.startPattern)) {
      const left = arabicNumber(match[1] ?? '');
      const right = match[2] ? arabicNumber(match[2]) : null;
      if (left === null || !options.acceptNumber(left, right) || match.index === undefined) continue;
      let at = match.index;
      if (/\s/.test(page.text[at] ?? '')) at += 1;
      if (options.acceptLine) {
        const lineEnd = page.text.indexOf('\n', at);
        const line = page.text.slice(at, lineEnd === -1 ? undefined : lineEnd);
        if (!options.acceptLine(line)) continue;
      }
      starts.push({ kind: 'hadith', number: left, offset: page.start + at });
    }
    starts.sort((a, b) => a.offset - b.offset);
    const merged: Array<GradeEvent | HadithEvent> = [];
    const lineGrades: Array<{ at: number; event: GradeEvent }> = [];
    let lineCursor = 0;
    for (const line of page.text.split('\n')) {
      const title = options.chapterOf(line);
      if (title) chapterAt.push({ at: page.start + lineCursor, title });
      const grade = options.useMarginGrades === false ? null : splitLeadingGrade(line);
      if (grade) {
        lineGrades.push({
          at: page.start + lineCursor,
          event: { kind: 'grade', token: displayToken(grade.token), grade: gradeOfToken(grade.token) },
        });
      }
      lineCursor += line.length + 1;
    }
    let gradeIndex = 0;
    let hadithIndex = 0;
    while (gradeIndex < lineGrades.length || hadithIndex < starts.length) {
      const grade = lineGrades[gradeIndex];
      const hadith = starts[hadithIndex];
      if (grade && (!hadith || grade.at <= hadith.offset)) {
        merged.push(grade.event);
        gradeIndex += 1;
      } else if (hadith) {
        merged.push(hadith);
        hadithIndex += 1;
      }
    }
    const grades = assignPageGrades(merged);
    const pageHadiths = merged.filter((event): event is HadithEvent => event.kind === 'hadith');
    if (pageHadiths.length === 0) {
      const leading = merged.find((event): event is GradeEvent => event.kind === 'grade');
      if (open && open.grade === HadithGrade.UNGRADED && leading) {
        open.grade = leading.grade;
        open.gradeToken = leading.token;
      }
    }
    for (let index = 0; index < pageHadiths.length; index += 1) {
      const event = pageHadiths[index]!;
      const grade = grades[index] ?? null;
      const title = [...chapterAt].reverse().find((change) => change.at <= event.offset)?.title ?? chapterTitle;
      const draft: Draft = {
        number: event.number,
        volume: page.volume,
        page: String(page.page),
        textAr: '',
        grade: grade?.grade ?? HadithGrade.UNGRADED,
        gradeToken: grade?.token ?? null,
        takhrij: null,
        chapterTitle: title,
        start: event.offset,
        end: text.length,
      };
      drafts.push(draft);
      open = draft;
    }
    if (chapterAt.length > 0) chapterTitle = chapterAt[chapterAt.length - 1]!.title;
  }

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index]!;
    const next = drafts[index + 1];
    draft.end = next ? next.start : text.length;
    const body = narrationBody(text.slice(draft.start, draft.end));
    const fromBody = options.gradeFromBody(body);
    if (draft.grade === HadithGrade.UNGRADED && fromBody.grade !== HadithGrade.UNGRADED) {
      draft.grade = fromBody.grade;
      draft.gradeToken = fromBody.token;
    }
    draft.takhrij = fromBody.takhrij;
    draft.textAr = body;
    if (options.useMarginGrades !== false) {
      const inline = stripInlineGrades(draft.textAr);
      draft.textAr = inline.text;
      if (draft.grade === HadithGrade.UNGRADED && inline.token) {
        draft.grade = gradeOfToken(inline.token);
        draft.gradeToken = displayToken(inline.token);
      }
    }
    draft.textAr = stripPageMarkers(draft.textAr);
  }

  const narrations = finish(
    drafts.filter((draft) => {
      if (arabicLetters(draft.textAr) < options.minLetters) return false;
      if (options.cue && !options.cue.test(foldArabic(draft.textAr))) return false;
      return true;
    }),
  );
  return { narrations, chapters: collectChapters(narrations) };
}

function targhibChapter(line: string): string | null {
  const folded = foldArabic(line)
    .replace(/^[0-9\u0660-\u0669\u06F0-\u06F9]+\s*[-–—]?\s*/, '')
    .replace(/^[()[\]]+\s*/, '');
  if (folded.length < 8 || folded.length > 90) return null;
  if (!/^(كتاب|الترغيب في|الترهيب من)\s+\S/.test(folded)) return null;
  return line.trim();
}

function riyadChapter(line: string): string | null {
  const folded = foldArabic(line).replace(/^[0-9\u0660-\u0669\u06F0-\u06F9]+\s*[-–—]?\s*/, '');
  if (!/^باب\s+\S/.test(folded) || folded.length > 200 || folded.includes('صلي')) return null;
  return line.trim();
}

/** A numbered line is a narration when it opens with an isnad, not a contents entry. */
function riyadNarrationLine(line: string): boolean {
  const folded = foldArabic(line).replace(/^[0-9\u0660-\u0669\u06F0-\u06F9]+\s*[-–—]?\s*/, '');
  return /^(?:وعن |عن |وعنه|عنه |قال |سمعت |حدثنا |اخبرنا |ف?الاول|ف?الثاني|ف?الثالث|ف?الرابع|ف?الخامس|ف?السادس|السابع|الثامن|التاسع|العاشر)/.test(
    folded,
  );
}

const RIYAD_CUE = /صلي|قال|عن |سمعت|حدثنا|اخبرنا/;

function riyadTakhrij(body: string): { grade: HadithGrade; token: string | null; takhrij: string | null } {
  for (const line of body.split('\n')) {
    const folded = foldArabic(line);
    const token =
      folded.includes('متفق عليه') || folded.includes('متفق علي صحته')
        ? 'متفق عليه'
        : folded.includes('رواه البخاري')
          ? 'رواه البخاري'
          : folded.includes('رواه مسلم')
            ? 'رواه مسلم'
            : null;
    if (!token) continue;
    return { grade: HadithGrade.SAHIH, token, takhrij: line.replace(/\s+/g, ' ').trim().slice(0, 180) };
  }
  return { grade: HadithGrade.UNGRADED, token: null, takhrij: null };
}

/** The number before the dash is the book number; the parenthetical resets inside the chapter. */
function targhibNarrationLine(line: string): boolean {
  const folded = foldArabic(line).replace(
    /^[0-9\u0660-\u0669\u06F0-\u06F9]+\s*[-–—]?\s*\(?\s*[0-9\u0660-\u0669\u06F0-\u06F9]+\s*\)?\s*/,
    '',
  );
  return /^(?:وعن |عن |وروي|روي |قال |سمعت |حدثنا |اخبرنا |ورواه|رواه |وان |ان )/.test(folded);
}

export function parseTarghib(text: string): { narrations: ParsedNarration[]; chapters: ParsedChapter[] } {
  return parseNumbered(text, {
    startPattern: new RegExp(`(${NUMBER}{1,4})\\s*[-–—]\\s*[\\(（]\\s*(${NUMBER}{1,4})\\s*[\\)）]`, 'g'),
    acceptNumber: (left, right) => right !== null && left >= 1 && left <= 5000 && right >= 1 && right <= 5000,
    chapterOf: targhibChapter,
    gradeFromBody: () => ({ grade: HadithGrade.UNGRADED, token: null, takhrij: null }),
    minLetters: 40,
    cue: RIYAD_CUE,
    acceptLine: targhibNarrationLine,
  });
}

export function parseRiyad(text: string): { narrations: ParsedNarration[]; chapters: ParsedChapter[] } {
  return parseNumbered(text, {
    startPattern: new RegExp(`(?:^|[\\s])(${NUMBER}{1,4})\\s*[-–—\\u0640]\\s+(?=[\\u0621-\\u064A])`, 'g'),
    acceptNumber: (left) => left >= 1 && left <= 2500,
    chapterOf: riyadChapter,
    gradeFromBody: riyadTakhrij,
    minLetters: 40,
    cue: RIYAD_CUE,
    useMarginGrades: false,
    acceptLine: riyadNarrationLine,
  });
}

export function parseZuhd(text: string): { narrations: ParsedNarration[]; chapters: ParsedChapter[] } {
  const pages = slicePages(text);
  const starts: Array<{ number: number; offset: number; volume: string; page: number }> = [];
  const pattern = new RegExp(`[()（）\\]]\\s*(${NUMBER}{1,4})\\s*[()（）\\[]`, 'g');
  for (const page of pages) {
    for (const match of page.text.matchAll(pattern)) {
      const number = arabicNumber(match[1] ?? '');
      if (number === null || number < 1 || number > 2000 || match.index === undefined) continue;
      const window = foldArabic(page.text.slice(match.index, match.index + 80));
      if (!/اخبرنا|حدثنا/.test(window)) continue;
      starts.push({ number, offset: page.start + match.index, volume: page.volume, page: page.page });
    }
  }
  const drafts: Array<Omit<ParsedNarration, 'occurrence'>> = starts.map((start, index) => {
    const end = starts[index + 1]?.offset ?? text.length;
    return {
      number: start.number,
      volume: start.volume,
      page: String(start.page),
      textAr: stripPageMarkers(narrationBody(text.slice(start.offset, end))),
      grade: HadithGrade.UNGRADED,
      gradeToken: null,
      takhrij: null,
      chapterTitle: null,
      start: start.offset,
      end,
    };
  });
  const narrations = finish(drafts.filter((draft) => arabicLetters(draft.textAr) >= 40));
  return { narrations, chapters: [] };
}

export function joinPages(pages: ReadonlyArray<{ volume: string; page: number; text: string }>): string {
  return pages.map((page) => `[[${page.volume}:${page.page}]]\n${page.text}`).join('\n');
}
