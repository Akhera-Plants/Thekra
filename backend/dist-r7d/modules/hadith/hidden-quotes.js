import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';
const LINE = /^\s*-\s*\{\s*id:\s*([0-9a-f-]{36})\s*,.*?reason:\s*([a-z-]+)\s*,\s*decision:\s*([A-Z]*)\s*\}\s*$/;
export function parseHiddenQuotes(text) {
    const rows = [];
    const seen = new Set();
    for (const line of text.split('\n')) {
        if (!line.trim().startsWith('- {'))
            continue;
        const match = LINE.exec(line);
        if (!match)
            throw new Error(`hidden-quotes.yaml: bad line ${line.trim().slice(0, 80)}`);
        const [, id, reason, decision] = match;
        if (decision !== '' && decision !== 'SHOW' && decision !== 'HIDE') {
            throw new Error(`hidden-quotes.yaml: decision must be SHOW, HIDE or empty, got ${decision}`);
        }
        if (seen.has(id))
            throw new Error(`hidden-quotes.yaml: ${id} is listed twice`);
        seen.add(id);
        rows.push({ id, reason, decision: decision === '' ? null : decision });
    }
    return rows;
}
let cached = null;
let cachedSet = null;
export function hiddenQuoteIds() {
    cached ??= parseHiddenQuotes(readTaxonomyFile('hidden-quotes.yaml'))
        .filter((row) => row.decision !== 'SHOW')
        .map((row) => row.id);
    return cached;
}
export function isHiddenQuote(id) {
    cachedSet ??= new Set(hiddenQuoteIds());
    return cachedSet.has(id);
}
//# sourceMappingURL=hidden-quotes.js.map