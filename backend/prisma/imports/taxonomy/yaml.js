import { readFileSync } from 'node:fs';
const DOMAIN_KEYS = new Set(['key', 'ar']);
const TOPIC_KEYS = new Set([
    'slug', 'ar', 'en', 'side', 'domain', 'opposite', 'kabair', 'riyad', 'targhib', 'zuhd',
    'minhaj', 'munajjid', 'kw', 'branches', 'contemporary', 'hidden', 'listed', 'derivedFrom', 'sideCheck',
]);
const AKHLAQ_KEYS = new Set(['key', 'ar', 'pair', 'balance', 'topics', 'note']);
const PAIR_KEYS = new Set(['avoid', 'do', 'ar']);
function unwrap(line) {
    const start = line.indexOf('{');
    const end = line.lastIndexOf('}');
    if (start < 0 || end <= start)
        throw new Error(`Expected a flow object: ${line.slice(0, 80)}`);
    return line.slice(start + 1, end);
}
function parseFlow(inner, keys) {
    const hits = [];
    let depth = 0;
    let valueStart = -1;
    let key = '';
    const begin = (at) => {
        const match = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:/.exec(inner.slice(at));
        if (!match?.[1] || !keys.has(match[1])) {
            throw new Error(`Unknown field near "${inner.slice(at, at + 40)}"`);
        }
        key = match[1];
        valueStart = at + match[0].length;
    };
    begin(0);
    for (let index = valueStart; index < inner.length; index += 1) {
        const char = inner[index];
        if (char === '[')
            depth += 1;
        else if (char === ']')
            depth -= 1;
        else if (char === ',' && depth === 0) {
            const match = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:/.exec(inner.slice(index + 1));
            if (match?.[1] && keys.has(match[1])) {
                hits.push({ key, valueStart, valueEnd: index });
                begin(index + 1);
                index = valueStart - 1;
            }
        }
    }
    hits.push({ key, valueStart, valueEnd: inner.length });
    return Object.fromEntries(hits.map((hit) => [hit.key, inner.slice(hit.valueStart, hit.valueEnd).trim()]));
}
function parseArray(value) {
    if (!value)
        return [];
    const match = /^\[(.*)\]$/.exec(value);
    if (!match)
        throw new Error(`Expected a list, got ${value}`);
    const body = match[1] ?? '';
    if (!body.trim())
        return [];
    return body.split(',').map((part) => part.trim().replace(/^["']|["']$/g, '')).filter((part) => part.length > 0);
}
function flag(value, fallback) {
    if (value === undefined || value === '')
        return fallback;
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    throw new Error(`Expected true or false, got ${value}`);
}
function requireString(fields, key) {
    const value = fields[key];
    if (!value)
        throw new Error(`Missing ${key}`);
    return value;
}
export function parseTaxonomy(text) {
    const domains = [];
    const topics = [];
    const akhlaq = [];
    const pairs = [];
    let section = null;
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('domains:'))
            section = 'domains';
        else if (trimmed.startsWith('topics:'))
            section = 'topics';
        else if (trimmed.startsWith('akhlaq:'))
            section = 'akhlaq';
        else if (trimmed.startsWith('pairs:'))
            section = 'pairs';
        else if (trimmed.startsWith('- {') && section === 'domains') {
            const fields = parseFlow(unwrap(line), DOMAIN_KEYS);
            domains.push({ key: requireString(fields, 'key'), nameAr: requireString(fields, 'ar'), order: domains.length + 1 });
        }
        else if (trimmed.startsWith('- {') && section === 'topics') {
            const fields = parseFlow(unwrap(line), TOPIC_KEYS);
            const side = requireString(fields, 'side');
            if (side !== 'AVOID' && side !== 'DO')
                throw new Error(`Bad side on ${fields['slug']}`);
            const riyad = parseArray(fields['riyad']);
            topics.push({
                slug: requireString(fields, 'slug'),
                ar: requireString(fields, 'ar'),
                en: requireString(fields, 'en'),
                side,
                domain: requireString(fields, 'domain'),
                opposite: fields['opposite'] ?? null,
                contemporary: flag(fields['contemporary'], false),
                hidden: flag(fields['hidden'], false),
                listed: flag(fields['listed'], true),
                sideCheck: flag(fields['sideCheck'], true),
                order: topics.length + 1,
                kabair: parseArray(fields['kabair']).map(Number),
                riyadNumbers: riyad.filter((entry) => /^\d+$/.test(entry)).map(Number),
                riyadPhrases: riyad.filter((entry) => !/^\d+$/.test(entry)),
                branches: parseArray(fields['branches']).map(Number),
                targhib: parseArray(fields['targhib']),
                zuhd: parseArray(fields['zuhd']),
                minhaj: parseArray(fields['minhaj']),
                munajjid: parseArray(fields['munajjid']),
                kw: parseArray(fields['kw']),
                derivedFrom: parseArray(fields['derivedFrom']),
            });
        }
        else if (trimmed.startsWith('- {') && section === 'akhlaq') {
            const fields = parseFlow(unwrap(line), AKHLAQ_KEYS);
            akhlaq.push({
                key: requireString(fields, 'key'),
                ar: requireString(fields, 'ar'),
                topics: parseArray(fields['topics']),
            });
        }
        else if (trimmed.startsWith('- {') && section === 'pairs') {
            const fields = parseFlow(unwrap(line), PAIR_KEYS);
            pairs.push({
                avoid: requireString(fields, 'avoid'),
                do: requireString(fields, 'do'),
                ar: fields['ar'] ?? null,
            });
        }
    }
    validate(domains, topics, akhlaq, pairs);
    return { domains, topics, akhlaq, pairs };
}
function validate(domains, topics, akhlaq, pairs) {
    const domainKeys = new Set(domains.map((domain) => domain.key));
    const bySlug = new Map(topics.map((topic) => [topic.slug, topic]));
    if (bySlug.size !== topics.length)
        throw new Error('Duplicate topic slug');
    for (const topic of topics) {
        if (!domainKeys.has(topic.domain))
            throw new Error(`${topic.slug} has unknown domain ${topic.domain}`);
        if (topic.kabair.some((number) => !Number.isInteger(number)))
            throw new Error(`${topic.slug} has a bad kabair number`);
        if (topic.opposite) {
            const other = bySlug.get(topic.opposite);
            if (!other)
                throw new Error(`${topic.slug} opposite ${topic.opposite} does not exist`);
            if (other.side === topic.side) {
                throw new Error(`${topic.slug} opposite ${topic.opposite} is the same side (${topic.side})`);
            }
        }
        for (const slug of topic.derivedFrom) {
            if (!bySlug.has(slug))
                throw new Error(`${topic.slug} derivedFrom ${slug} does not exist`);
        }
    }
    const kabiraOwner = new Map();
    for (const topic of topics) {
        for (const number of topic.kabair) {
            const owner = kabiraOwner.get(number);
            if (owner)
                throw new Error(`Kabira ${number} is on both ${owner} and ${topic.slug}`);
            kabiraOwner.set(number, topic.slug);
        }
    }
    for (const label of akhlaq) {
        for (const slug of label.topics) {
            if (!bySlug.has(slug))
                throw new Error(`Akhlaq ${label.key} names unknown topic ${slug}`);
        }
    }
    const pairSlugs = new Set();
    for (const pair of pairs) {
        const avoid = bySlug.get(pair.avoid);
        const deed = bySlug.get(pair.do);
        if (!avoid)
            throw new Error(`Pair avoid ${pair.avoid} does not exist`);
        if (!deed)
            throw new Error(`Pair do ${pair.do} does not exist`);
        if (avoid.side !== 'AVOID')
            throw new Error(`Pair avoid ${pair.avoid} is not AVOID`);
        if (deed.side !== 'DO')
            throw new Error(`Pair do ${pair.do} is not DO`);
        if (pairSlugs.has(pair.avoid) || pairSlugs.has(pair.do)) {
            throw new Error(`Pair ${pair.avoid}/${pair.do} reuses a slug already in pairs`);
        }
        pairSlugs.add(pair.avoid);
        pairSlugs.add(pair.do);
    }
}
export function loadTaxonomy(path) {
    return parseTaxonomy(readFileSync(path, 'utf8'));
}
export function topicBySlug(topics) {
    return new Map(topics.map((topic) => [topic.slug, topic]));
}
//# sourceMappingURL=yaml.js.map