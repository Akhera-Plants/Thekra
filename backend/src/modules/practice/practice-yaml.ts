/**
 * A small YAML reader for the nested reviewer files under prisma/taxonomy/
 * (deed-schedules.yaml, sin-programs.yaml). The backend has no YAML
 * dependency; the other reviewer files are read line by line
 * (topic-pairs.ts, topic-themes.ts), which does not scale to nested data.
 *
 * Supported, and nothing more: block mappings and sequences (by indentation,
 * including `- key: value` items and a sequence at its key's indentation),
 * flow mappings and sequences on one line, plain / 'single' / "double" quoted
 * scalars, integers, true / false / null, folded (`>`, `>-`) and literal
 * (`|`, `|-`) block scalars, full-line and trailing comments. Anything else
 * throws with the file name and line number, so a reviewer edit that this
 * reader would misread fails the unit test instead of shipping.
 *
 * As in YAML, a comma inside an unquoted flow item ends the item: write
 * `['a, b', c]` when a list entry contains a comma.
 */
export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };
export type YamlMap = { [key: string]: YamlValue };

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:(?:\s+(.*))?$/;
const BLOCK_SCALAR = /^([>|])(-?)$/;
const INTEGER = /^-?\d+$/;

interface ContentLine {
  /** 1-based line number, for errors. */
  no: number;
  indent: number;
  text: string;
}

function isSequenceItem(text: string): boolean {
  return text === '-' || text.startsWith('- ');
}

/** Cuts a trailing ` # comment` that is outside quotes. A quote opens only at the start of a scalar. */
function stripComment(text: string): string {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const before = index === 0 ? ' ' : text[index - 1]!;
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if ((char === '"' || char === "'") && /[\s[{,:]/.test(before)) quote = char;
    else if (char === '#' && /\s/.test(before)) return text.slice(0, index).trimEnd();
  }
  return text.trimEnd();
}

function scalar(raw: string): YamlValue {
  const value = raw.trim();
  if (value === '' || value === '~' || value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (INTEGER.test(value)) return Number(value);
  return value;
}

/** One flow value (`{…}`, `[…]`, quoted or plain) on a single line. */
class FlowReader {
  private at = 0;

  constructor(
    private readonly text: string,
    private readonly fail: (message: string) => never,
  ) {}

  read(): YamlValue {
    const value = this.value(false);
    this.skipSpace();
    if (this.at < this.text.length) this.fail(`unexpected "${this.text.slice(this.at, this.at + 20)}"`);
    return value;
  }

  private skipSpace(): void {
    while (this.at < this.text.length && /\s/.test(this.text[this.at]!)) this.at += 1;
  }

  private value(inFlow: boolean): YamlValue {
    this.skipSpace();
    const char = this.text[this.at];
    if (char === '[') return this.sequence();
    if (char === '{') return this.mapping();
    if (char === '"' || char === "'") return this.quoted(char);
    return this.plain(inFlow);
  }

  private plain(inFlow: boolean): YamlValue {
    const start = this.at;
    while (this.at < this.text.length && !(inFlow && /[,\]}]/.test(this.text[this.at]!))) this.at += 1;
    const raw = this.text.slice(start, this.at);
    if (/^\s*[[\]{}]/.test(raw)) this.fail(`unexpected "${raw.trim().slice(0, 20)}"`);
    return scalar(raw);
  }

  private quoted(quote: '"' | "'"): string {
    let out = '';
    this.at += 1;
    while (this.at < this.text.length) {
      const char = this.text[this.at]!;
      if (quote === "'" && char === "'" && this.text[this.at + 1] === "'") {
        out += "'";
        this.at += 2;
        continue;
      }
      if (char === quote) {
        this.at += 1;
        return out;
      }
      if (quote === '"' && char === '\\') {
        const next = this.text[this.at + 1];
        const escapes: Record<string, string> = { n: '\n', t: '\t', '"': '"', '\\': '\\' };
        if (next === undefined || !(next in escapes)) this.fail(`unsupported escape \\${next ?? ''}`);
        out += escapes[next];
        this.at += 2;
        continue;
      }
      out += char;
      this.at += 1;
    }
    return this.fail('unterminated quoted string');
  }

  private sequence(): YamlValue[] {
    const items: YamlValue[] = [];
    this.at += 1;
    this.skipSpace();
    if (this.text[this.at] === ']') {
      this.at += 1;
      return items;
    }
    for (;;) {
      items.push(this.value(true));
      this.skipSpace();
      const char = this.text[this.at];
      this.at += 1;
      if (char === ']') return items;
      if (char !== ',') this.fail('expected "," or "]" in a flow sequence');
    }
  }

  private mapping(): YamlMap {
    const map: YamlMap = {};
    this.at += 1;
    this.skipSpace();
    if (this.text[this.at] === '}') {
      this.at += 1;
      return map;
    }
    for (;;) {
      this.skipSpace();
      const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:/.exec(this.text.slice(this.at));
      if (!match?.[1]) this.fail('expected "key:" in a flow mapping');
      const key = match[1];
      if (Object.hasOwn(map, key)) this.fail(`duplicate key "${key}"`);
      this.at += match[0].length;
      map[key] = this.value(true);
      this.skipSpace();
      const char = this.text[this.at];
      this.at += 1;
      if (char === '}') return map;
      if (char !== ',') this.fail('expected "," or "}" in a flow mapping');
    }
  }
}

class BlockParser {
  private index = 0;
  private readonly lines: string[];

  constructor(
    source: string,
    private readonly name: string,
  ) {
    this.lines = source.split(/\r?\n/);
  }

  parseDocument(): YamlValue {
    const first = this.peek();
    if (!first) return null;
    if (first.indent !== 0) this.fail(first.no, 'the document must start at column 0');
    const value = this.node(0);
    const rest = this.peek();
    if (rest) this.fail(rest.no, 'unexpected content (check the indentation)');
    return value;
  }

  private fail(lineNo: number, message: string): never {
    throw new Error(`${this.name}:${lineNo}: ${message}`);
  }

  /** The next line with content (blank and comment-only lines skipped), without consuming it. */
  private peek(): ContentLine | null {
    while (this.index < this.lines.length) {
      const raw = this.lines[this.index]!;
      if (raw.includes('\t')) this.fail(this.index + 1, 'tabs are not allowed in YAML indentation');
      const text = stripComment(raw.trim());
      if (text) return { no: this.index + 1, indent: raw.length - raw.trimStart().length, text };
      this.index += 1;
    }
    return null;
  }

  private node(indent: number): YamlValue {
    const line = this.peek()!;
    return isSequenceItem(line.text) ? this.sequence(indent) : this.mapping(indent, null);
  }

  /**
   * A block mapping at `indent`. `first` is the text of a first entry already
   * taken from a `- key: value` sequence line (its column is `indent`).
   */
  private mapping(indent: number, first: ContentLine | null): YamlMap {
    const map: YamlMap = {};
    let pending = first;
    for (;;) {
      let line = pending;
      pending = null;
      if (!line) {
        const next = this.peek();
        if (!next || next.indent < indent || (next.indent === indent && isSequenceItem(next.text))) break;
        if (next.indent > indent) this.fail(next.no, 'unexpected indentation');
        this.index += 1;
        line = next;
      }
      const match = KEY_LINE.exec(line.text);
      if (!match?.[1]) this.fail(line.no, `expected "key: value", got "${line.text.slice(0, 40)}"`);
      const key = match[1];
      if (Object.hasOwn(map, key)) this.fail(line.no, `duplicate key "${key}"`);
      map[key] = this.valueAfterKey(match[2] ?? '', indent, line.no);
    }
    return map;
  }

  private valueAfterKey(rest: string, indent: number, lineNo: number): YamlValue {
    if (rest === '') {
      const next = this.peek();
      if (next && next.indent > indent) return this.node(next.indent);
      if (next && next.indent === indent && isSequenceItem(next.text)) return this.sequence(indent);
      return null;
    }
    const block = BLOCK_SCALAR.exec(rest);
    if (block) return this.blockScalar(block[1] as '>' | '|', block[2] === '-', indent);
    return new FlowReader(rest, (message) => this.fail(lineNo, message)).read();
  }

  private sequence(indent: number): YamlValue[] {
    const items: YamlValue[] = [];
    for (;;) {
      const line = this.peek();
      if (!line || line.indent < indent) break;
      if (line.indent > indent) this.fail(line.no, 'unexpected indentation');
      if (!isSequenceItem(line.text)) break;
      this.index += 1;
      const content = line.text.slice(1).trimStart();
      const column = indent + line.text.length - content.length;
      if (content === '') {
        const next = this.peek();
        items.push(next && next.indent > indent ? this.node(next.indent) : null);
      } else if (isSequenceItem(content)) {
        this.fail(line.no, 'nested "- - item" sequences are not supported');
      } else if (KEY_LINE.test(content)) {
        items.push(this.mapping(column, { no: line.no, indent: column, text: content }));
      } else {
        items.push(new FlowReader(content, (message) => this.fail(line.no, message)).read());
      }
    }
    return items;
  }

  /** `>` folds lines with spaces (a blank line is a newline); `|` keeps them. `-` strips the final newline. */
  private blockScalar(style: '>' | '|', strip: boolean, parentIndent: number): string {
    const body: string[] = [];
    let contentIndent: number | null = null;
    while (this.index < this.lines.length) {
      const raw = this.lines[this.index]!;
      if (raw.trim() === '') {
        body.push('');
        this.index += 1;
        continue;
      }
      const lineIndent = raw.length - raw.trimStart().length;
      if (lineIndent <= parentIndent) break;
      contentIndent ??= lineIndent;
      if (lineIndent < contentIndent) this.fail(this.index + 1, 'block scalar line is less indented than its first line');
      body.push(raw.slice(contentIndent).trimEnd());
      this.index += 1;
    }
    while (body.length > 0 && body[body.length - 1] === '') body.pop();
    let text = '';
    body.forEach((line, position) => {
      if (position === 0) text = line;
      else if (style === '|') text += `\n${line}`;
      else if (line === '') text += '\n';
      else text += text.endsWith('\n') ? line : ` ${line}`;
    });
    if (strip || text === '') return text;
    return `${text}\n`;
  }
}

/** Parses the supported YAML subset. Throws `name:line: message` on anything else. */
export function parseYaml(source: string, name = 'yaml'): YamlValue {
  return new BlockParser(source, name).parseDocument();
}
