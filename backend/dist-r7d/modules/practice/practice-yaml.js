const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:(?:\s+(.*))?$/;
const BLOCK_SCALAR = /^([>|])(-?)$/;
const INTEGER = /^-?\d+$/;
function isSequenceItem(text) {
    return text === '-' || text.startsWith('- ');
}
function stripComment(text) {
    let quote = null;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const before = index === 0 ? ' ' : text[index - 1];
        if (quote) {
            if (char === quote)
                quote = null;
            continue;
        }
        if ((char === '"' || char === "'") && /[\s[{,:]/.test(before))
            quote = char;
        else if (char === '#' && /\s/.test(before))
            return text.slice(0, index).trimEnd();
    }
    return text.trimEnd();
}
function scalar(raw) {
    const value = raw.trim();
    if (value === '' || value === '~' || value === 'null')
        return null;
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    if (INTEGER.test(value))
        return Number(value);
    return value;
}
class FlowReader {
    at = 0;
    text;
    fail;
    constructor(text, fail) {
        this.text = text;
        this.fail = fail;
    }
    read() {
        const value = this.value(false);
        this.skipSpace();
        if (this.at < this.text.length)
            this.fail(`unexpected "${this.text.slice(this.at, this.at + 20)}"`);
        return value;
    }
    skipSpace() {
        while (this.at < this.text.length && /\s/.test(this.text[this.at]))
            this.at += 1;
    }
    value(inFlow) {
        this.skipSpace();
        const char = this.text[this.at];
        if (char === '[')
            return this.sequence();
        if (char === '{')
            return this.mapping();
        if (char === '"' || char === "'")
            return this.quoted(char);
        return this.plain(inFlow);
    }
    plain(inFlow) {
        const start = this.at;
        while (this.at < this.text.length && !(inFlow && /[,\]}]/.test(this.text[this.at])))
            this.at += 1;
        const raw = this.text.slice(start, this.at);
        if (/^\s*[[\]{}]/.test(raw))
            this.fail(`unexpected "${raw.trim().slice(0, 20)}"`);
        return scalar(raw);
    }
    quoted(quote) {
        let out = '';
        this.at += 1;
        while (this.at < this.text.length) {
            const char = this.text[this.at];
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
                const escapes = { n: '\n', t: '\t', '"': '"', '\\': '\\' };
                if (next === undefined || !(next in escapes))
                    this.fail(`unsupported escape \\${next ?? ''}`);
                out += escapes[next];
                this.at += 2;
                continue;
            }
            out += char;
            this.at += 1;
        }
        return this.fail('unterminated quoted string');
    }
    sequence() {
        const items = [];
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
            if (char === ']')
                return items;
            if (char !== ',')
                this.fail('expected "," or "]" in a flow sequence');
        }
    }
    mapping() {
        const map = {};
        this.at += 1;
        this.skipSpace();
        if (this.text[this.at] === '}') {
            this.at += 1;
            return map;
        }
        for (;;) {
            this.skipSpace();
            const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:/.exec(this.text.slice(this.at));
            if (!match?.[1])
                this.fail('expected "key:" in a flow mapping');
            const key = match[1];
            if (Object.hasOwn(map, key))
                this.fail(`duplicate key "${key}"`);
            this.at += match[0].length;
            map[key] = this.value(true);
            this.skipSpace();
            const char = this.text[this.at];
            this.at += 1;
            if (char === '}')
                return map;
            if (char !== ',')
                this.fail('expected "," or "}" in a flow mapping');
        }
    }
}
class BlockParser {
    index = 0;
    lines;
    name;
    constructor(source, name) {
        this.name = name;
        this.lines = source.split(/\r?\n/);
    }
    parseDocument() {
        const first = this.peek();
        if (!first)
            return null;
        if (first.indent !== 0)
            this.fail(first.no, 'the document must start at column 0');
        const value = this.node(0);
        const rest = this.peek();
        if (rest)
            this.fail(rest.no, 'unexpected content (check the indentation)');
        return value;
    }
    fail(lineNo, message) {
        throw new Error(`${this.name}:${lineNo}: ${message}`);
    }
    peek() {
        while (this.index < this.lines.length) {
            const raw = this.lines[this.index];
            if (raw.includes('\t'))
                this.fail(this.index + 1, 'tabs are not allowed in YAML indentation');
            const text = stripComment(raw.trim());
            if (text)
                return { no: this.index + 1, indent: raw.length - raw.trimStart().length, text };
            this.index += 1;
        }
        return null;
    }
    node(indent) {
        const line = this.peek();
        return isSequenceItem(line.text) ? this.sequence(indent) : this.mapping(indent, null);
    }
    mapping(indent, first) {
        const map = {};
        let pending = first;
        for (;;) {
            let line = pending;
            pending = null;
            if (!line) {
                const next = this.peek();
                if (!next || next.indent < indent || (next.indent === indent && isSequenceItem(next.text)))
                    break;
                if (next.indent > indent)
                    this.fail(next.no, 'unexpected indentation');
                this.index += 1;
                line = next;
            }
            const match = KEY_LINE.exec(line.text);
            if (!match?.[1])
                this.fail(line.no, `expected "key: value", got "${line.text.slice(0, 40)}"`);
            const key = match[1];
            if (Object.hasOwn(map, key))
                this.fail(line.no, `duplicate key "${key}"`);
            map[key] = this.valueAfterKey(match[2] ?? '', indent, line.no);
        }
        return map;
    }
    valueAfterKey(rest, indent, lineNo) {
        if (rest === '') {
            const next = this.peek();
            if (next && next.indent > indent)
                return this.node(next.indent);
            if (next && next.indent === indent && isSequenceItem(next.text))
                return this.sequence(indent);
            return null;
        }
        const block = BLOCK_SCALAR.exec(rest);
        if (block)
            return this.blockScalar(block[1], block[2] === '-', indent);
        return new FlowReader(rest, (message) => this.fail(lineNo, message)).read();
    }
    sequence(indent) {
        const items = [];
        for (;;) {
            const line = this.peek();
            if (!line || line.indent < indent)
                break;
            if (line.indent > indent)
                this.fail(line.no, 'unexpected indentation');
            if (!isSequenceItem(line.text))
                break;
            this.index += 1;
            const content = line.text.slice(1).trimStart();
            const column = indent + line.text.length - content.length;
            if (content === '') {
                const next = this.peek();
                items.push(next && next.indent > indent ? this.node(next.indent) : null);
            }
            else if (isSequenceItem(content)) {
                this.fail(line.no, 'nested "- - item" sequences are not supported');
            }
            else if (KEY_LINE.test(content)) {
                items.push(this.mapping(column, { no: line.no, indent: column, text: content }));
            }
            else {
                items.push(new FlowReader(content, (message) => this.fail(line.no, message)).read());
            }
        }
        return items;
    }
    blockScalar(style, strip, parentIndent) {
        const body = [];
        let contentIndent = null;
        while (this.index < this.lines.length) {
            const raw = this.lines[this.index];
            if (raw.trim() === '') {
                body.push('');
                this.index += 1;
                continue;
            }
            const lineIndent = raw.length - raw.trimStart().length;
            if (lineIndent <= parentIndent)
                break;
            contentIndent ??= lineIndent;
            if (lineIndent < contentIndent)
                this.fail(this.index + 1, 'block scalar line is less indented than its first line');
            body.push(raw.slice(contentIndent).trimEnd());
            this.index += 1;
        }
        while (body.length > 0 && body[body.length - 1] === '')
            body.pop();
        let text = '';
        body.forEach((line, position) => {
            if (position === 0)
                text = line;
            else if (style === '|')
                text += `\n${line}`;
            else if (line === '')
                text += '\n';
            else
                text += text.endsWith('\n') ? line : ` ${line}`;
        });
        if (strip || text === '')
            return text;
        return `${text}\n`;
    }
}
export function parseYaml(source, name = 'yaml') {
    return new BlockParser(source, name).parseDocument();
}
//# sourceMappingURL=practice-yaml.js.map