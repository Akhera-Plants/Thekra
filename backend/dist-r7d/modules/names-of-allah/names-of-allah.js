import { normalizeArabic } from '../../common/text/arabic-normalizer.js';
import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';
import { topicSide } from '../taxonomy/topic-pairs.js';
import { parseYaml } from '../practice/practice-yaml.js';
export const NAME_ACTIONS = ['leave-sin'];
const FILE = 'names-of-allah.yaml';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^(\d{1,3}):(\d{1,3})$/;
const SLUG = /^[a-z]+(?:-[a-z]+)*$/;
const ARABIC_WORD = /^[ء-ي]+$/;
const NAME_FIELDS = ['name', 'slug', 'ref', 'quoteId', 'meaningAr', 'meaningEn', 'links', 'bare'];
const SURAH_MAX = 114;
function fail(message) {
    throw new Error(`${FILE}: ${message}`);
}
function isMap(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(entry, key, where) {
    const value = entry[key];
    if (typeof value !== 'string' || value.trim() === '')
        fail(`${where}: ${key} must be a non-empty string`);
    return value.trim();
}
function parseLink(raw, where) {
    if (typeof raw !== 'string')
        fail(`${where}: a link must be a string like "deed:tawba"`);
    const [kind, slug, extra] = raw.split(':');
    if (extra !== undefined || !kind || !slug)
        fail(`${where}: link "${raw}" must be kind:slug`);
    if (kind === 'deed') {
        if (topicSide(slug) !== 'DO')
            fail(`${where}: "${slug}" is not a good deed in taxonomy.yaml`);
    }
    else if (kind === 'sin') {
        if (topicSide(slug) !== 'AVOID')
            fail(`${where}: "${slug}" is not a sin in taxonomy.yaml`);
    }
    else if (kind === 'action') {
        if (!NAME_ACTIONS.includes(slug))
            fail(`${where}: action "${slug}" is not one of ${NAME_ACTIONS.join(', ')}`);
    }
    else {
        fail(`${where}: link kind "${kind}" must be deed, sin or action`);
    }
    return { kind: kind, slug };
}
export function buildNamesOfAllah(source) {
    const root = parseYaml(source, FILE);
    if (!isMap(root))
        fail('expected a mapping');
    const unknown = Object.keys(root).find((key) => !['review', 'names'].includes(key));
    if (unknown)
        fail(`unknown field "${unknown}"`);
    if (typeof root['review'] !== 'string' || !root['review'])
        fail('review must be a non-empty string');
    const list = root['names'];
    if (!Array.isArray(list) || list.length === 0)
        fail('names must be a non-empty list');
    const seenNames = new Set();
    const seenSlugs = new Set();
    const names = list.map((entry, index) => {
        const where = `names[${index}]`;
        if (!isMap(entry))
            fail(`${where} must be a mapping`);
        const extra = Object.keys(entry).find((key) => !NAME_FIELDS.includes(key));
        if (extra)
            fail(`${where}: unknown field "${extra}"`);
        const nameAr = text(entry, 'name', where);
        const normalized = normalizeArabic(nameAr);
        if (!ARABIC_WORD.test(normalized) || !normalized.startsWith('ال') || normalized.length < 3) {
            fail(`${where}: name "${nameAr}" must be one Arabic word with «ال»`);
        }
        if (seenNames.has(normalized))
            fail(`${where}: name "${nameAr}" is listed twice`);
        seenNames.add(normalized);
        const slug = text(entry, 'slug', where);
        if (!SLUG.test(slug))
            fail(`${where}: slug "${slug}" must be lowercase ASCII words joined by "-"`);
        if (seenSlugs.has(slug))
            fail(`${where}: slug "${slug}" is listed twice`);
        seenSlugs.add(slug);
        const ref = text(entry, 'ref', where);
        const refMatch = REF.exec(ref);
        const surah = Number(refMatch?.[1]);
        const ayah = Number(refMatch?.[2]);
        if (!refMatch || surah < 1 || surah > SURAH_MAX || ayah < 1)
            fail(`${where}: ref "${ref}" must be surah:ayah`);
        const quoteId = text(entry, 'quoteId', where);
        if (!UUID.test(quoteId))
            fail(`${where}: quoteId "${quoteId}" is not a UUID`);
        const linksRaw = entry['links'] ?? [];
        if (!Array.isArray(linksRaw))
            fail(`${where}: links must be a list`);
        const links = linksRaw.map((link) => parseLink(link, where));
        if (new Set(links.map((l) => `${l.kind}:${l.slug}`)).size !== links.length)
            fail(`${where}: a link is listed twice`);
        const bare = entry['bare'] ?? true;
        if (typeof bare !== 'boolean')
            fail(`${where}: bare must be true or false`);
        return {
            number: index + 1,
            slug,
            nameAr,
            ref,
            surah,
            ayah,
            quoteId: quoteId.toLowerCase(),
            meaningAr: text(entry, 'meaningAr', where),
            meaningEn: text(entry, 'meaningEn', where),
            links,
            bare,
        };
    });
    return { review: root['review'], names };
}
let cached = null;
export function namesOfAllah() {
    cached ??= buildNamesOfAllah(readTaxonomyFile(FILE));
    return cached;
}
export function nameOfAllahBySlug(slug) {
    return namesOfAllah().names.find((name) => name.slug === slug) ?? null;
}
export function nameWordPattern(name) {
    const withAl = normalizeArabic(name.nameAr);
    if (!ARABIC_WORD.test(withAl))
        throw new Error(`${FILE}: "${name.nameAr}" is not an Arabic word`);
    const bareForm = withAl.slice(2);
    const forms = name.bare ? `[وف]?${withAl}|${bareForm}` : `[وف]?${withAl}`;
    return `(^|[^ء-ي])(${forms})([^ء-ي]|$)`;
}
//# sourceMappingURL=names-of-allah.js.map