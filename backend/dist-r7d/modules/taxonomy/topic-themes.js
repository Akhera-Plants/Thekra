import { readTaxonomyFile, taxonomyFilePath } from './taxonomy-files.js';
const THEME_KEYS = new Set(['topic', 'key', 'ar', 'en', 'match']);
export const THEME_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_THEMES_PER_TOPIC = 8;
export function normTheme(value) {
    return value
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[ىی]/g, 'ي')
        .replace(/ک/g, 'ك')
        .replace(/[()[\]{}«»"'.,،؛;:!?؟\-–—_/\\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function parseFlow(inner) {
    const fields = {};
    let depth = 0;
    let key = null;
    let valueStart = 0;
    const begin = (at) => {
        const match = /^\s*([A-Za-z]+)\s*:/.exec(inner.slice(at));
        if (!match?.[1] || !THEME_KEYS.has(match[1])) {
            throw new Error(`topic-themes: unknown field near "${inner.slice(at, at + 40)}"`);
        }
        key = match[1];
        return at + match[0].length;
    };
    valueStart = begin(0);
    for (let index = valueStart; index < inner.length; index += 1) {
        const char = inner[index];
        if (char === '[')
            depth += 1;
        else if (char === ']')
            depth -= 1;
        else if (char === ',' && depth === 0) {
            const next = /^\s*([A-Za-z]+)\s*:/.exec(inner.slice(index + 1));
            if (next?.[1] && THEME_KEYS.has(next[1]) && key) {
                fields[key] = inner.slice(valueStart, index).trim();
                valueStart = begin(index + 1);
                index = valueStart - 1;
            }
        }
    }
    if (key)
        fields[key] = inner.slice(valueStart).trim();
    return fields;
}
function parseList(value) {
    const match = /^\[(.*)\]$/.exec(value ?? '');
    if (!match)
        throw new Error(`topic-themes: expected a list, got ${value ?? 'nothing'}`);
    return (match[1] ?? '')
        .split(',')
        .map((part) => part.trim().replace(/^["']|["']$/g, ''))
        .filter((part) => part.length > 0);
}
function text(fields, key, line) {
    const value = (fields[key] ?? '').replace(/^["']|["']$/g, '').trim();
    if (!value)
        throw new Error(`topic-themes line ${line}: missing ${key}`);
    return value;
}
export function parseTopicThemes(source) {
    const themes = [];
    const lines = source.split('\n');
    lines.forEach((raw, index) => {
        const trimmed = raw.trim();
        if (!trimmed.startsWith('- {'))
            return;
        const inner = trimmed.slice(trimmed.indexOf('{') + 1, trimmed.lastIndexOf('}'));
        const fields = parseFlow(inner);
        const line = index + 1;
        const match = parseList(fields['match']).map(normTheme).filter((part) => part.length > 0);
        if (match.length === 0)
            throw new Error(`topic-themes line ${line}: match is empty`);
        themes.push({
            topic: text(fields, 'topic', line),
            key: text(fields, 'key', line),
            ar: text(fields, 'ar', line),
            en: text(fields, 'en', line),
            match,
            order: themes.length,
        });
    });
    const keys = new Set();
    const perTopic = new Map();
    for (const theme of themes) {
        if (!THEME_KEY_PATTERN.test(theme.key))
            throw new Error(`topic-themes: bad key ${theme.key}`);
        if (keys.has(theme.key))
            throw new Error(`topic-themes: duplicate key ${theme.key}`);
        keys.add(theme.key);
        const count = (perTopic.get(theme.topic) ?? 0) + 1;
        if (count > MAX_THEMES_PER_TOPIC)
            throw new Error(`topic-themes: ${theme.topic} has more than ${MAX_THEMES_PER_TOPIC} themes`);
        perTopic.set(theme.topic, count);
    }
    return themes;
}
export function chapterTitleFromNote(note) {
    if (!note)
        return null;
    const takhrij = /ورد في باب:\s*(.+)\s+من\s+[^—]+$/.exec(note);
    if (takhrij?.[1])
        return takhrij[1];
    const chapter = /في باب:\s*(.+?)\s+—\s+[^—]+$/.exec(note) ?? /^من باب:\s*(.+?)\s+—\s+[^—]+$/.exec(note)
        ?? /حسب موضوع الباب:\s*(.+?)\s+—\s+[^—]+$/.exec(note) ?? /عنوان الباب:\s*(.+?)\s+—\s+[^—]+$/.exec(note);
    return chapter?.[1] ?? null;
}
export function isGenericTitle(title) {
    const folded = normTheme(title);
    return folded.length < 6 || /^(فصل|باب|فصل في|فصل منه)$/.test(folded) || /^فصل \d*$/.test(folded);
}
export function themeHaystack(input) {
    const parts = [];
    if (input.sectionTitle) {
        parts.push(input.sectionTitle);
        if (isGenericTitle(input.sectionTitle))
            parts.push(...input.parentTitles.slice(0, 1));
    }
    const fromNote = chapterTitleFromNote(input.note);
    if (fromNote && !(input.sectionTitle && normTheme(fromNote) === normTheme(input.sectionTitle))) {
        parts.push(fromNote);
        if (!input.sectionTitle && isGenericTitle(fromNote))
            parts.push(...input.parentTitles.slice(0, 1));
    }
    return ` ${normTheme(parts.join(' | '))} `;
}
export function matchThemeKeys(themes, haystack) {
    const padded = ` ${haystack.trim()} `;
    return themes.filter((theme) => theme.match.some((pattern) => padded.includes(` ${pattern} `))).map((theme) => theme.key);
}
let cached = null;
export function topicThemesPath() {
    return taxonomyFilePath('topic-themes.yaml');
}
function load() {
    if (cached)
        return cached;
    let source = '';
    try {
        source = readTaxonomyFile('topic-themes.yaml');
    }
    catch {
        source = '';
    }
    const themes = parseTopicThemes(source);
    const byTopic = new Map();
    for (const theme of themes)
        byTopic.set(theme.topic, [...(byTopic.get(theme.topic) ?? []), theme]);
    cached = { themes, byTopic, byKey: new Map(themes.map((theme) => [theme.key, theme])) };
    return cached;
}
export function resetTopicThemesCache() {
    cached = null;
}
export function allTopicThemes() {
    return load().themes;
}
export function themesForTopics(slugs) {
    const index = load().byTopic;
    return slugs.flatMap((slug) => index.get(slug) ?? []);
}
export function themeByKey(key) {
    return load().byKey.get(key) ?? null;
}
//# sourceMappingURL=topic-themes.js.map