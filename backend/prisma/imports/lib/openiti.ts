/**
 * Pure reader for OpenITI mARkdown (no I/O).
 *
 * Text is kept verbatim except for markup: milestone tokens (`ms0005`), page
 * tokens (`PageV01P083`), stray HTML tags and the line-wrap markers are removed,
 * and whitespace is collapsed. Nothing is "corrected".
 *
 * Page tracking — two marker kinds exist in Shamela-derived files:
 *  - `### | [ص: N]` page breaks (reliable, but some pages have none);
 *  - `PageVxxPyyy` record markers (V00P000 carries no page; others may lag behind).
 * A PageV marker only moves the page forward or opens a later volume. A `[ص: N]`
 * that drops far below the current page starts the next volume.
 */

export interface OpenitiBlock {
  kind: 'heading' | 'paragraph';
  text: string;
  /** 1-based line in the source file. */
  line: number;
  /** Volume the page counter belongs to, or null before the first PageV marker. */
  volume: number | null;
  page: number | null;
}

export interface OpenitiRecord {
  heading: string;
  line: number;
  volume: number | null;
  page: number | null;
  paragraphs: OpenitiBlock[];
  body: string;
}

const HEADER_END = '#META#Header#End#';
const HEADING_PREFIX = /^###\s*(?:\|+|\$+)\s?/;
const PAGE_BREAK = /^\[ص:\s*(\d+)\s*\]$/;
const PAGE_TOKEN = /PageV(\d+)P(\d+)/g;
const MILESTONE = /\bms\d+\b/g;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;
/** A page break this far below the current page means a new volume began. */
const VOLUME_RESET_DROP = 20;

export function cleanInline(text: string): string {
  return text
    .replace(PAGE_TOKEN, ' ')
    .replace(MILESTONE, ' ')
    .replace(HTML_TAG, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

class PageCounter {
  volume: number | null = null;
  page: number | null = null;

  applyPageTokens(raw: string): void {
    for (const match of raw.matchAll(PAGE_TOKEN)) {
      this.applyPageV(Number(match[1]), Number(match[2]));
    }
  }

  applyPageBreak(page: number): void {
    if (this.page !== null && page < this.page - VOLUME_RESET_DROP && this.volume !== null) {
      this.volume += 1;
    }
    this.page = page;
  }

  private applyPageV(volume: number, page: number): void {
    if (volume === 0 || page === 0) return;
    if (this.volume === null || volume > this.volume) {
      this.volume = volume;
      this.page = page;
    } else if (volume === this.volume && (this.page === null || page > this.page)) {
      this.page = page;
    }
  }
}

/** Flat stream of headings and paragraphs, with the page in force where each starts. */
export function readBlocks(source: string): OpenitiBlock[] {
  const lines = source.split(/\r?\n/);
  const headerEnd = lines.findIndex((line) => line.startsWith(HEADER_END));
  const counter = new PageCounter();
  const blocks: OpenitiBlock[] = [];
  const pending: { parts: string[]; line: number; volume: number | null; page: number | null }[] = [];

  const flush = (): void => {
    const paragraph = pending.pop();
    if (!paragraph) return;
    const text = cleanInline(paragraph.parts.join(' '));
    if (text) {
      blocks.push({ kind: 'paragraph', text, line: paragraph.line, volume: paragraph.volume, page: paragraph.page });
    }
  };
  const startParagraph = (content: string, line: number): void => {
    pending.push({ parts: [content], line, volume: counter.volume, page: counter.page });
  };

  for (let index = headerEnd + 1; index < lines.length; index++) {
    const raw = lines[index] ?? '';
    const lineNumber = index + 1;

    if (raw.startsWith('###') && !raw.startsWith('####')) {
      flush();
      const text = cleanInline(raw.replace(HEADING_PREFIX, ''));
      const pageBreak = PAGE_BREAK.exec(text);
      if (pageBreak) {
        counter.applyPageBreak(Number(pageBreak[1]));
        continue;
      }
      if (text) {
        blocks.push({ kind: 'heading', text, line: lineNumber, volume: counter.volume, page: counter.page });
      }
      counter.applyPageTokens(raw);
      continue;
    }

    if (raw.startsWith('# ') || raw === '#') {
      flush();
      const content = raw.slice(2);
      // A line holding only page tokens is a marker, not a paragraph.
      if (cleanInline(content)) startParagraph(content, lineNumber);
      counter.applyPageTokens(content);
      continue;
    }

    if (raw.startsWith('~~')) {
      const content = raw.slice(2);
      const open = pending.at(-1);
      if (open) open.parts.push(content);
      else if (cleanInline(content)) startParagraph(content, lineNumber);
      counter.applyPageTokens(content);
    }
  }
  flush();
  return blocks;
}

/** Groups blocks into records: each heading plus the paragraphs up to the next heading. */
export function readRecords(source: string): OpenitiRecord[] {
  const records: OpenitiRecord[] = [];
  let current: OpenitiRecord | null = null;
  for (const block of readBlocks(source)) {
    if (block.kind === 'heading') {
      current = { heading: block.text, line: block.line, volume: block.volume, page: block.page, paragraphs: [], body: '' };
      records.push(current);
      continue;
    }
    if (!current) {
      current = { heading: '', line: block.line, volume: block.volume, page: block.page, paragraphs: [], body: '' };
      records.push(current);
    }
    current.paragraphs.push(block);
  }
  for (const record of records) record.body = joinParagraphs(record.paragraphs);
  return records;
}

export function joinParagraphs(paragraphs: readonly OpenitiBlock[]): string {
  return paragraphs.map((paragraph) => paragraph.text).join('\n');
}
