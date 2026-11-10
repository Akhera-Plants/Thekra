import { readTaxonomyFile } from './taxonomy-files.js';
let cached = null;
function field(inner, key) {
    const match = new RegExp(`(?:^|,)\\s*${key}\\s*:\\s*([^,\\]}]+)`).exec(inner);
    if (!match?.[1])
        return null;
    return match[1].trim().replace(/^["']|["']$/g, '');
}
function parseTopics(text) {
    const topics = new Map();
    let section = null;
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('topics:')) {
            section = 'topics';
            continue;
        }
        if (trimmed.startsWith('pairs:')) {
            section = 'pairs';
            continue;
        }
        if (trimmed.startsWith('domains:') || trimmed.startsWith('akhlaq:')) {
            section = null;
            continue;
        }
        if (!trimmed.startsWith('- {') || section !== 'topics')
            continue;
        const inner = trimmed.slice(trimmed.indexOf('{') + 1, trimmed.lastIndexOf('}'));
        const slug = field(inner, 'slug');
        const ar = field(inner, 'ar');
        const en = field(inner, 'en');
        const side = field(inner, 'side');
        const branchList = /(?:^|,)\s*branches\s*:\s*\[([^\]]*)\]/.exec(inner)?.[1] ?? '';
        const branches = branchList
            .split(',')
            .map((part) => Number(part.trim()))
            .filter((n) => Number.isInteger(n) && n > 0);
        if (slug && ar && en)
            topics.set(slug, { slug, ar, en, side: side === 'AVOID' || side === 'DO' ? side : null, branches });
    }
    return topics;
}
function parsePairs(text, topics) {
    const pairs = [];
    let inPairs = false;
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('pairs:')) {
            inPairs = true;
            continue;
        }
        if (!inPairs)
            continue;
        if (!trimmed.startsWith('- {'))
            continue;
        const inner = trimmed.slice(trimmed.indexOf('{') + 1, trimmed.lastIndexOf('}'));
        const avoid = field(inner, 'avoid');
        const deed = field(inner, 'do');
        if (!avoid || !deed)
            throw new Error(`Bad pair line: ${trimmed.slice(0, 80)}`);
        const topic = topics.get(deed);
        if (!topic)
            throw new Error(`Pair do ${deed} missing from taxonomy`);
        pairs.push({
            avoid,
            do: deed,
            titleAr: field(inner, 'ar') ?? topic.ar,
            titleEn: topic.en,
        });
    }
    return pairs;
}
function load() {
    if (cached)
        return cached;
    const text = readTaxonomyFile('taxonomy.yaml');
    const topics = parseTopics(text);
    const pairs = parsePairs(text, topics);
    const bySlug = new Map();
    for (const pair of pairs) {
        bySlug.set(pair.avoid, pair);
        bySlug.set(pair.do, pair);
    }
    cached = { bySlug, pairs, topics };
    return cached;
}
export function resetTopicPairsCache() {
    cached = null;
}
export function pairForSlug(slug) {
    return load().bySlug.get(slug) ?? null;
}
export function allTopicPairs() {
    return load().pairs;
}
export function isPairedSlug(slug) {
    return load().bySlug.has(slug);
}
export function topicSide(slug) {
    return load().topics.get(slug)?.side ?? null;
}
export function topicBranches(slug) {
    return load().topics.get(slug)?.branches ?? [];
}
export function topicNames(slug) {
    const row = load().topics.get(slug);
    return row ? { ar: row.ar, en: row.en } : null;
}
//# sourceMappingURL=topic-pairs.js.map