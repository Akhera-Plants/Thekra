import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';
const LINE = /^\s*-\s*\{\s*id:\s*([0-9a-f-]{36})\s*,.*?decision:\s*([A-Z]*)\s*\}\s*$/;
export function parseTextReview(text) {
    const rows = [];
    for (const line of text.split('\n')) {
        if (!line.trim().startsWith('- {'))
            continue;
        const match = LINE.exec(line);
        if (!match)
            throw new Error(`text-review.yaml: bad line ${line.trim().slice(0, 80)}`);
        const decision = match[2] || null;
        if (decision !== null && decision !== 'COMPLETE' && decision !== 'FRAGMENT') {
            throw new Error(`text-review.yaml: decision must be COMPLETE, FRAGMENT or empty, got ${decision}`);
        }
        rows.push({ id: match[1], decision });
    }
    return rows;
}
let cached = null;
export function unfeaturableTextIds() {
    cached ??= parseTextReview(readTaxonomyFile('text-review.yaml'))
        .filter((row) => row.decision !== 'COMPLETE')
        .map((row) => row.id);
    return cached;
}
//# sourceMappingURL=text-review.js.map