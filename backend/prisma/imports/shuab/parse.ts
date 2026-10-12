/**
 * Pure parser for al-Bayhaqi, «الجامع لشعب الإيمان», ط الرشد
 * (OpenITI 0458Bayhaqi.ShucabIman.Shamela0010660-ara1).
 *
 * - Narrations: headings `### | N - `; text runs to the next heading or branch heading.
 * - Branches: body paragraphs «<ordinal> من شعب الإيمان، وهو باب في …». Branches whose
 *   ordinal line is absent (bare «وهو باب في …») are numbered by position only when
 *   they exactly fill the gap between two located branches.
 * - Heading-number typos are repaired only when unambiguous (see `repairNumbers`).
 */
import { parseLeadingOrdinal } from '../lib/arabic-ordinal.js';
import { joinParagraphs, readBlocks, type OpenitiBlock } from '../lib/openiti.js';

/** Narration ranges per printed volume (owner's PDF metadata). ج14 = indexes. */
const SHUAB_VOLUMES: ReadonlyArray<readonly [volume: number, first: number, last: number]> = [
  [1, 1, 399],
  [2, 400, 1344],
  [3, 1345, 2104],
  [4, 2105, 3020],
  [5, 3021, 3792],
  [6, 3793, 4567],
  [7, 4568, 5420],
  [8, 5421, 6178],
  [9, 6179, 7088],
  [10, 7089, 8051],
  [11, 8052, 8924],
  [12, 8925, 9868],
  [13, 9869, 10756],
];

const TOTAL_BRANCHES = 77;

export function shuabVolumeOf(number: number): number | null {
  return SHUAB_VOLUMES.find(([, first, last]) => number >= first && number <= last)?.[0] ?? null;
}

export interface ShuabBranch {
  number: number;
  titleAr: string;
  /** Verbatim heading text up to the end of the title (lines joined with « / »). */
  headingText: string;
  volume: number | null;
  page: number | null;
  line: number;
  numberedBy: 'ordinal' | 'position';
  reviewNotes: string[];
}

export interface ShuabNarration {
  number: number;
  /** 1 for the first heading with this number, 2+ for repeated numbers (e.g. «(أ)/(ب)»). */
  occurrence: number;
  /** Number as written in the corpus heading (differs from `number` when repaired). */
  corpusNumber: number;
  volume: number | null;
  page: number | null;
  textAr: string;
  branchNumber: number | null;
  chapterTitle: string | null;
  line: number;
}

export interface NumberRepair {
  line: number;
  corpusNumber: number;
  repairedTo: number;
}

export interface ShuabParseResult {
  branches: ShuabBranch[];
  narrations: ShuabNarration[];
  /** Numbers 1..max with no heading in the corpus (text likely sits in the previous narration). */
  missingNumbers: number[];
  repairs: NumberRepair[];
  /** Numbers that still occur more than once after repair. */
  repeatedNumbers: number[];
  /** Branch numbers 1..77 that could not be located. */
  unlocatedBranches: number[];
  /** Narrations whose page is unknown (page counter not yet in the narration's volume). */
  pageUnknown: number[];
}

const NARRATION_HEADING = /^(\d+)\s*-[\s-]*(.*)$/;
const BRANCH_SUFFIX = /^\s*من شعب الإيمان/;
const UNNUMBERED_BRANCH = /^وهو باب(?=\s|$)/;
/** Optional punctuation, «وهو», «باب», «في» before a branch title. */
const TITLE_LEAD = /^[\s"،,:؛]*(?:وهو(?=\s|$))?\s*(?:باب(?:\s+في)?(?=\s|$))?\s*/;
/** Where a branch title stops: start of commentary, a quotation, an aya, or an explanatory clause. */
const TITLE_END = /["{«:.]|\s+قال(?=[\s:،]|$)|\s+(?:وهو|وهي|فأما|وأما|فإذا|إما)\s/;
const TITLE_TRIM = /^[\s"،,:؛.]+|[\s"،,:؛.]+$/g;
const TITLE_TRAILING = /[\s"،,:؛.]+$/;
const LONG_TITLE = 70;

export function parseShuab(source: string): ShuabParseResult {
  const blocks = readBlocks(source);
  const branchMarks = locateBranches(blocks);
  const narrationBlocks = collectNarrations(blocks, branchMarks);
  const { numbers, repairs } = repairNumbers(narrationBlocks.map((entry) => entry.corpusNumber));

  const branches = branchMarks.located;
  const occurrences = new Map<number, number>();
  const narrations: ShuabNarration[] = narrationBlocks.map((entry, index) => {
    const number = numbers[index] ?? entry.corpusNumber;
    const occurrence = (occurrences.get(number) ?? 0) + 1;
    occurrences.set(number, occurrence);
    const volume = shuabVolumeOf(number);
    return {
      number,
      occurrence,
      corpusNumber: entry.corpusNumber,
      volume,
      page: entry.pageVolume === volume ? entry.page : null,
      textAr: entry.text,
      branchNumber: entry.branchNumber,
      chapterTitle: entry.chapterTitle,
      line: entry.line,
    };
  });

  fixBranchVolumes(branches, narrations);

  const seen = new Set(narrations.map((narration) => narration.number));
  const max = Math.max(0, ...seen);
  const located = new Set(branches.map((branch) => branch.number));
  return {
    branches,
    narrations,
    missingNumbers: range(1, max).filter((number) => !seen.has(number)),
    repairs: repairs.map((repair) => ({ ...repair, line: narrationBlocks[repair.index]?.line ?? 0 })),
    repeatedNumbers: [...occurrences].filter(([, count]) => count > 1).map(([number]) => number),
    unlocatedBranches: range(1, TOTAL_BRANCHES).filter((number) => !located.has(number)),
    pageUnknown: narrations.filter((narration) => narration.page === null).map((narration) => narration.number),
  };
}

// ── Branches ────────────────────────────────────────────────────────────────

interface BranchMarks {
  located: ShuabBranch[];
  /** Block index → branch number, for every block that starts a branch (title blocks included). */
  byBlock: Map<number, number>;
  /** Block indexes that belong to a branch heading (never narration text). */
  headingBlocks: Set<number>;
}

function locateBranches(blocks: readonly OpenitiBlock[]): BranchMarks {
  const located: ShuabBranch[] = [];
  const byBlock = new Map<number, number>();
  const headingBlocks = new Set<number>();
  const unnumbered: Array<{ index: number; previous: number }> = [];

  blocks.forEach((block, index) => {
    if (block.kind !== 'paragraph' || headingBlocks.has(index)) return;
    const ordinal = parseLeadingOrdinal(block.text);
    if (ordinal && BRANCH_SUFFIX.test(block.text.slice(ordinal.length))) {
      const branch = buildBranch(blocks, index, ordinal.value, 'ordinal', headingBlocks);
      located.push(branch);
      byBlock.set(index, branch.number);
      return;
    }
    if (UNNUMBERED_BRANCH.test(block.text)) {
      unnumbered.push({ index, previous: located.at(-1)?.number ?? 0 });
    }
  });

  // Bare «وهو باب في …» headings: number them only if they exactly fill a gap.
  const groups = new Map<number, number[]>();
  for (const entry of unnumbered) groups.set(entry.previous, [...(groups.get(entry.previous) ?? []), entry.index]);
  for (const [previous, indexes] of groups) {
    const next = located.find((branch) => branch.number > previous)?.number;
    if (next === undefined || next - previous - 1 !== indexes.length) continue;
    indexes.forEach((index, offset) => {
      const branch = buildBranch(blocks, index, previous + offset + 1, 'position', headingBlocks);
      located.push(branch);
      byBlock.set(index, branch.number);
    });
  }
  located.sort((a, b) => a.line - b.line);
  return { located, byBlock, headingBlocks };
}

function buildBranch(
  blocks: readonly OpenitiBlock[],
  index: number,
  number: number,
  numberedBy: ShuabBranch['numberedBy'],
  headingBlocks: Set<number>,
): ShuabBranch {
  const block = blocks[index] as OpenitiBlock;
  headingBlocks.add(index);
  const reviewNotes: string[] = [];
  if (numberedBy === 'position') reviewNotes.push('ordinal absent in corpus; number inferred from position');

  const ordinal = numberedBy === 'ordinal' ? parseLeadingOrdinal(block.text) : null;
  const suffix = ordinal ? BRANCH_SUFFIX.exec(block.text.slice(ordinal.length)) : null;
  const offset = ordinal && suffix ? ordinal.length + suffix[0].length : 0;
  let title = extractTitle(block.text.slice(offset));
  let headingText = block.text.slice(0, offset + title.end);
  if (!title.text) {
    // Title sits on the next block (e.g. «السبعون من شعب الإيمان وهو» / «باب في …»).
    const next = blocks[index + 1];
    if (next) {
      headingBlocks.add(index + 1);
      title = extractTitle(next.text);
      headingText = `${block.text} / ${next.text.slice(0, title.end)}`;
    }
  }
  if (!title.text) reviewNotes.push('title not found');
  if (title.text.length > LONG_TITLE) reviewNotes.push('long title — owner to shorten');
  return {
    number,
    titleAr: title.text,
    headingText: headingText.trim(),
    volume: block.volume,
    page: block.page,
    line: block.line,
    numberedBy,
    reviewNotes,
  };
}

/** Title = text after «(وهو) باب (في)» up to the first commentary boundary, verbatim. */
export function extractTitle(text: string): { text: string; end: number } {
  let start = TITLE_LEAD.exec(text)?.[0].length ?? 0;
  let rest = text.slice(start);
  const quoted = /^"\s*/.exec(rest);
  if (quoted) {
    // «باب في " تعظيم القرآن "» — the title is the quoted phrase.
    start += quoted[0].length;
    rest = rest.slice(quoted[0].length);
    const close = rest.indexOf('"');
    if (close !== -1) rest = rest.slice(0, close);
  } else {
    const stop = TITLE_END.exec(rest);
    if (stop) rest = rest.slice(0, stop.index);
  }
  // `end` stops before trailing punctuation so the cited heading ends with the title.
  const kept = rest.replace(TITLE_TRAILING, '');
  return { text: kept.replace(TITLE_TRIM, ''), end: start + kept.length };
}

// ── Narrations ──────────────────────────────────────────────────────────────

interface NarrationBlock {
  corpusNumber: number;
  text: string;
  line: number;
  page: number | null;
  pageVolume: number | null;
  branchNumber: number | null;
  chapterTitle: string | null;
}

function collectNarrations(blocks: readonly OpenitiBlock[], marks: BranchMarks): NarrationBlock[] {
  const narrations: NarrationBlock[] = [];
  const titles = new Map(marks.located.map((branch) => [branch.number, branch.titleAr]));
  let branchNumber: number | null = null;
  let chapterTitle: string | null = null;
  let open: { entry: NarrationBlock; paragraphs: OpenitiBlock[] } | null = null;
  let mergeNext = false;

  const close = (): void => {
    mergeNext = false;
    if (!open) return;
    open.entry.text = joinParagraphs(open.paragraphs);
    narrations.push(open.entry);
    open = null;
  };

  blocks.forEach((block, index) => {
    const startsBranch = marks.byBlock.get(index);
    if (startsBranch !== undefined) {
      close();
      branchNumber = startsBranch;
      chapterTitle = titles.get(startsBranch) ?? null;
      return;
    }
    if (marks.headingBlocks.has(index)) return;

    if (block.kind === 'heading' && open && isMidSentenceHeading(block.text, open.paragraphs.at(-1))) {
      // A word the conversion promoted to a heading mid-sentence: keep it in the text.
      mergeNext = true;
      appendInline(open.paragraphs, block, true);
      return;
    }
    if (block.kind === 'heading') {
      close();
      const heading = NARRATION_HEADING.exec(block.text);
      if (!heading) {
        chapterTitle = block.text;
        return;
      }
      const remainder = (heading[2] ?? '').trim();
      open = {
        entry: {
          corpusNumber: Number(heading[1]),
          text: '',
          line: block.line,
          page: block.page,
          pageVolume: block.volume,
          branchNumber,
          chapterTitle,
        },
        paragraphs: remainder ? [{ ...block, text: remainder }] : [],
      };
      return;
    }
    if (open) {
      appendInline(open.paragraphs, block, mergeNext);
      mergeNext = false;
    }
  });
  close();
  return narrations;
}

const SENTENCE_END = /["”»)\]}.؟?!:]\s*$/;
const SECTION_HEADING = /^(?:باب|فصل)(?:\s|$)/;

/**
 * True for a heading that is really a fragment of the running sentence (the
 * Shamela conversion turned a word into `### |`): it is not «باب/فصل…» and the
 * narration's last paragraph stops without closing punctuation.
 */
function isMidSentenceHeading(text: string, previous: OpenitiBlock | undefined): boolean {
  if (!previous || NARRATION_HEADING.test(text) || SECTION_HEADING.test(text)) return false;
  return !SENTENCE_END.test(previous.text);
}

function appendInline(paragraphs: OpenitiBlock[], block: OpenitiBlock, merge: boolean): void {
  const last = paragraphs.at(-1);
  if (merge && last) paragraphs[paragraphs.length - 1] = { ...last, text: `${last.text} ${block.text}` };
  else paragraphs.push(block);
}

/**
 * Repairs a heading number only when all hold: it is out of order (not above the
 * previous number, or above the next written number), the expected number
 * (previous + 1) has no heading anywhere, the written number is a one-digit typo
 * or off-by-one of the expected one, and the next heading continues the repaired
 * sequence. Real gaps and lettered duplicates («(أ)/(ب)») stay as written.
 */
export function repairNumbers(corpusNumbers: readonly number[]): {
  numbers: number[];
  repairs: Array<{ index: number; corpusNumber: number; repairedTo: number }>;
} {
  const present = new Set(corpusNumbers);
  const numbers: number[] = [];
  const repairs: Array<{ index: number; corpusNumber: number; repairedTo: number }> = [];

  const isRepairable = (written: number, expected: number): boolean =>
    !present.has(expected) && isTypoOf(written, expected);

  corpusNumbers.forEach((written, index) => {
    const previous = numbers[index - 1] ?? 0;
    const expected = previous + 1;
    const next = corpusNumbers[index + 1];
    const outOfOrder = written <= previous || (next !== undefined && written > next);
    const nextContinues =
      next === undefined || next === expected + 1 || (next < expected && isRepairable(next, expected + 1));
    if (index > 0 && outOfOrder && isRepairable(written, expected) && nextContinues) {
      numbers.push(expected);
      repairs.push({ index, corpusNumber: written, repairedTo: expected });
      return;
    }
    numbers.push(written);
  });
  return { numbers, repairs };
}

function isTypoOf(written: number, expected: number): boolean {
  if (Math.abs(written - expected) === 1) return true;
  const a = String(written);
  const b = String(expected);
  if (a.length !== b.length) return false;
  let differences = 0;
  for (let position = 0; position < a.length; position++) if (a[position] !== b[position]) differences++;
  return differences === 1;
}

/** A branch heading at the start of a volume can precede that volume's first page marker. */
function fixBranchVolumes(branches: ShuabBranch[], narrations: readonly ShuabNarration[]): void {
  for (const branch of branches) {
    const first = narrations.find((narration) => narration.line > branch.line);
    if (!first || first.volume === null || first.volume === branch.volume) continue;
    branch.volume = first.volume;
    branch.page = null;
    branch.reviewNotes.push('heading opens a volume; page not marked in corpus');
  }
}

function range(first: number, last: number): number[] {
  const values: number[] = [];
  for (let value = first; value <= last; value++) values.push(value);
  return values;
}
