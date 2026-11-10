const WILDCARD = '*';
const WILDCARD_CLASS = '[a-z0-9-]+';
const PLACEHOLDER = 'x0wildcard0x';
export class CorsOriginsConfigError extends Error {
    constructor(entry, reason) {
        super(`Invalid CORS_ORIGINS entry "${entry}": ${reason}`);
        this.name = 'CorsOriginsConfigError';
    }
}
function isSerializedOrigin(value) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        return false;
    }
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function compilePattern(entry) {
    if (entry.indexOf(WILDCARD) !== entry.lastIndexOf(WILDCARD)) {
        throw new CorsOriginsConfigError(entry, 'a pattern may contain only one "*"');
    }
    const candidate = entry.replace(WILDCARD, PLACEHOLDER);
    if (!isSerializedOrigin(candidate)) {
        throw new CorsOriginsConfigError(entry, 'a pattern must be a lowercase http(s) origin with no path or trailing slash');
    }
    const { hostname } = new URL(candidate);
    const labels = hostname.split('.');
    const [firstLabel] = labels;
    if (labels.length < 2 || !firstLabel?.includes(PLACEHOLDER)) {
        throw new CorsOriginsConfigError(entry, 'the "*" must sit in the leftmost label of a multi-label host');
    }
    if (firstLabel === PLACEHOLDER) {
        throw new CorsOriginsConfigError(entry, 'a whole-label "*" trusts every subdomain; add a literal prefix or suffix, or list the origins');
    }
    const [before, after] = entry.split(WILDCARD);
    return new RegExp(`^${escapeRegExp(before)}${WILDCARD_CLASS}${escapeRegExp(after)}$`);
}
export function parseCorsOrigins(raw) {
    const rules = [];
    for (const piece of raw.split(',')) {
        const entry = piece.trim();
        if (!entry)
            continue;
        if (entry === WILDCARD) {
            throw new CorsOriginsConfigError(entry, 'a bare "*" is not allowed together with credentials; list the origins');
        }
        if (entry.toLowerCase() === 'null') {
            throw new CorsOriginsConfigError(entry, 'the "null" origin (sandboxed iframes, file://) must never be trusted with credentials');
        }
        if (entry.includes(WILDCARD)) {
            rules.push(compilePattern(entry));
            continue;
        }
        if (!isSerializedOrigin(entry)) {
            throw new CorsOriginsConfigError(entry, 'expected an origin such as https://example.com (lowercase, no path or trailing slash)');
        }
        rules.push(entry);
    }
    return rules;
}
export function isAllowedCorsOrigin(rules, origin) {
    if (origin === undefined)
        return false;
    return rules.some((rule) => (typeof rule === 'string' ? rule === origin : rule.test(origin)));
}
export const PUBLIC_SITE_ORIGIN = 'https://thekra-web.vercel.app';
export const BUILT_IN_CORS_ORIGINS = [
    PUBLIC_SITE_ORIGIN,
    'https://thekra-web-*-almekdadmohammadgmailcoms-projects.vercel.app',
];
export function corsOriginRules(raw) {
    const rules = parseCorsOrigins([...BUILT_IN_CORS_ORIGINS, raw ?? ''].join(','));
    const seen = new Set();
    return rules.filter((rule) => {
        const key = typeof rule === 'string' ? rule : rule.source;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
//# sourceMappingURL=cors-origins.js.map