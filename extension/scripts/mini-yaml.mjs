/**
 * A tiny, strict YAML reader for the subset used by `backend/prisma/taxonomy/deed-schedules.yaml`.
 * Written here so the extension needs no YAML dependency (repo rule: no new npm dependency).
 *
 * Supported:
 *   - full-line comments (`# …`) and blank lines; a ` #` comment after a value
 *   - block mappings (`key: value`, `key:` followed by an indented block)
 *   - block sequences (`- value`, `- key: value` starting a mapping item)
 *   - flow mappings `{ a: 1, b: [1, 2] }` and flow sequences `[a, 'b', 3]`, nested
 *   - single-quoted ('it''s'), double-quoted ("a\"b") and plain scalars
 *   - plain scalars: integers and decimals become numbers; true/false/null/~ become booleans/null;
 *     everything else stays a string (dates such as 2026-10-30 stay strings, unlike YAML 1.1 timestamps)
 *
 * Anything else (anchors, tags, multi-line strings, `? ` keys, tabs for indentation, duplicate keys) throws
 * with a line number, so a change to the catalog file that this reader cannot represent fails the build loudly
 * instead of producing a wrong catalog.
 */

/** @param {string} message @param {number} line */
function fail(message, line) {
  throw new SyntaxError(`mini-yaml: ${message} (line ${line})`);
}

/** Strips a trailing ` #` comment that is outside quotes. */
function stripComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) {
        if (quote === "'" && text[i + 1] === "'") i++;
        else quote = null;
      } else if (quote === '"' && c === '\\') i++;
    } else if (c === "'" || c === '"') {
      // Quotes only open a scalar at the start of a token.
      const prev = text[i - 1];
      if (i === 0 || prev === ' ' || prev === '[' || prev === '{' || prev === ',' || prev === ':') quote = c;
    } else if (c === '#' && (i === 0 || text[i - 1] === ' ')) {
      return text.slice(0, i).trimEnd();
    }
  }
  return text.trimEnd();
}

const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?$/;

/** @param {string} raw @param {number} line @param {boolean} inFlow */
function plainScalar(raw, line, inFlow) {
  const s = raw.trim();
  if (s === '') return null;
  if (/^[&*!|>%@`]/.test(s)) fail(`unsupported YAML feature in ${JSON.stringify(s)}`, line);
  if (/^[-?:](\s|$)/.test(s)) fail(`unsupported indicator in ${JSON.stringify(s)}`, line);
  if (!inFlow && /:(\s|$)/.test(s)) fail(`unexpected ": " in plain scalar ${JSON.stringify(s)}`, line);
  if (inFlow && /[{}[\]]/.test(s)) fail(`unexpected bracket in ${JSON.stringify(s)}`, line);
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (NUMBER.test(s)) return Number(s);
  return s;
}

/** Reads a quoted scalar starting at `src[pos]`. Returns [value, nextPos]. */
function quoted(src, pos, line) {
  const q = src[pos];
  let out = '';
  let i = pos + 1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q === "'") {
      if (c === "'") {
        if (src[i + 1] === "'") {
          out += "'";
          i++;
          continue;
        }
        return [out, i + 1];
      }
      out += c;
    } else {
      if (c === '\\') {
        const n = src[++i];
        const map = { n: '\n', t: '\t', '"': '"', '\\': '\\', '/': '/' };
        if (!(n in map)) fail(`unsupported escape \\${n}`, line);
        out += map[n];
        continue;
      }
      if (c === '"') return [out, i + 1];
      out += c;
    }
  }
  return fail('unterminated quoted string', line);
}

/** Parses a flow value (`{…}`, `[…]`, quoted or plain) starting at `pos`. Returns [value, nextPos]. */
function flowValue(src, pos, line) {
  while (src[pos] === ' ') pos++;
  const c = src[pos];
  if (c === '{' || c === '[') {
    const close = c === '{' ? '}' : ']';
    const isMap = c === '{';
    const out = isMap ? {} : [];
    pos++;
    for (;;) {
      while (src[pos] === ' ') pos++;
      if (src[pos] === close) return [out, pos + 1];
      if (pos >= src.length) fail(`unterminated flow collection, expected ${close}`, line);
      if (isMap) {
        let key;
        if (src[pos] === "'" || src[pos] === '"') {
          [key, pos] = quoted(src, pos, line);
        } else {
          const m = /^[A-Za-z0-9_-]+/.exec(src.slice(pos));
          if (!m) fail('expected a key in flow mapping', line);
          key = m[0];
          pos += key.length;
        }
        while (src[pos] === ' ') pos++;
        if (src[pos] !== ':') fail(`expected ":" after key ${key}`, line);
        pos++;
        let value;
        [value, pos] = flowValue(src, pos, line);
        if (Object.prototype.hasOwnProperty.call(out, key)) fail(`duplicate key ${key}`, line);
        out[key] = value;
      } else {
        let value;
        [value, pos] = flowValue(src, pos, line);
        out.push(value);
      }
      while (src[pos] === ' ') pos++;
      if (src[pos] === ',') pos++;
      else if (src[pos] !== close) fail(`expected "," or ${close}`, line);
    }
  }
  if (c === "'" || c === '"') return quoted(src, pos, line);
  let end = pos;
  while (end < src.length && src[end] !== ',' && src[end] !== '}' && src[end] !== ']') end++;
  return [plainScalar(src.slice(pos, end), line, true), end];
}

/** A value written after `key: ` or `- ` on one line. */
function inlineValue(text, line) {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[') || t.startsWith("'") || t.startsWith('"')) {
    const [value, end] = flowValue(t, 0, line);
    if (t.slice(end).trim() !== '') fail(`unexpected text after value: ${t.slice(end)}`, line);
    return value;
  }
  return plainScalar(t, line, false);
}

const KEY = /^([A-Za-z0-9_-]+):(?:\s+(.*))?$/;

/**
 * Parses the supported subset. Returns plain objects, arrays, strings, numbers, booleans and null.
 * @param {string} text
 * @returns {unknown}
 */
export function parseMiniYaml(text) {
  /** @type {{indent: number, text: string, line: number}[]} */
  const lines = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (/\t/.test(/^[\t ]*/.exec(raw)?.[0] ?? '')) fail('tabs are not allowed for indentation', i + 1);
    const body = stripComment(raw);
    if (body.trim() === '') return;
    if (body.trim() === '---') return;
    lines.push({ indent: body.length - body.trimStart().length, text: body.trim(), line: i + 1 });
  });
  let idx = 0;

  /** Parses the block that starts at lines[idx] with exactly `indent`. */
  function block(indent) {
    const first = lines[idx];
    if (!first || first.indent !== indent) fail('unexpected indentation', first?.line ?? 0);
    return first.text.startsWith('- ') || first.text === '-' ? sequence(indent) : mapping(indent);
  }

  function mapping(indent, seed = {}) {
    const out = seed;
    while (idx < lines.length && lines[idx].indent === indent) {
      const { text: t, line } = lines[idx];
      if (t.startsWith('- ')) break;
      const m = KEY.exec(t);
      if (!m) fail(`expected "key: value", got ${JSON.stringify(t)}`, line);
      const [, key, rest] = m;
      if (Object.prototype.hasOwnProperty.call(out, key)) fail(`duplicate key ${key}`, line);
      idx++;
      if (rest === undefined || rest === '') {
        const next = lines[idx];
        if (next && next.indent > indent) out[key] = block(next.indent);
        else if (next && next.indent === indent && next.text.startsWith('- ')) out[key] = sequence(indent);
        else out[key] = null;
      } else {
        out[key] = inlineValue(rest, line);
      }
    }
    if (idx < lines.length && lines[idx].indent > indent) fail('unexpected indentation', lines[idx].line);
    return out;
  }

  function sequence(indent) {
    const out = [];
    while (idx < lines.length && lines[idx].indent === indent && (lines[idx].text.startsWith('- ') || lines[idx].text === '-')) {
      const { text: t, line } = lines[idx];
      const rest = t === '-' ? '' : t.slice(2).trim();
      const itemIndent = indent + 2;
      if (rest === '') {
        idx++;
        const next = lines[idx];
        out.push(next && next.indent > indent ? block(next.indent) : null);
        continue;
      }
      const m = KEY.exec(rest);
      if (m && !rest.startsWith('{') && !rest.startsWith('[')) {
        // `- key: value` starts a mapping whose other keys sit at indent + 2.
        lines[idx] = { indent: itemIndent, text: rest, line };
        out.push(mapping(itemIndent));
      } else {
        idx++;
        out.push(inlineValue(rest, line));
      }
    }
    return out;
  }

  if (lines.length === 0) return null;
  const result = block(lines[0].indent);
  if (idx < lines.length) fail('unexpected content', lines[idx].line);
  return result;
}
