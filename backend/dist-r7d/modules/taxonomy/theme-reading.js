import { QuoteType } from '@prisma/client';
import { dedupeReading, READING_SELECT } from '../classification/reading.js';
import { normTheme } from './topic-themes.js';
function labelOf(theme) {
    return normTheme(theme.ar) || normTheme(theme.en);
}
export function mergePageThemes(themes, sinSlug) {
    const groups = new Map();
    for (const theme of themes)
        groups.set(labelOf(theme), [...(groups.get(labelOf(theme)) ?? []), theme]);
    const result = [];
    const done = new Set();
    for (const theme of themes) {
        const label = labelOf(theme);
        if (done.has(label))
            continue;
        done.add(label);
        const group = groups.get(label) ?? [theme];
        const topics = new Set(group.map((member) => member.topic));
        if (topics.size < 2) {
            for (const member of group)
                result.push({ key: member.key, ar: member.ar, en: member.en, keys: [member.key] });
        }
        else {
            const head = group.find((member) => member.topic === sinSlug) ?? group[0] ?? theme;
            result.push({ key: head.key, ar: head.ar, en: head.en, keys: group.map((member) => member.key) });
        }
    }
    return result;
}
export function findActiveTheme(pageThemes, requested) {
    if (!requested)
        return null;
    return pageThemes.find((theme) => theme.key === requested)
        ?? pageThemes.find((theme) => theme.keys.includes(requested))
        ?? null;
}
const SUMMARY_SELECT = {
    quoteId: true,
    themeKeys: true,
    quote: { select: { type: true, isAthar: true, atharReviewDecision: true } },
};
function withKeys(where, keys) {
    return { ...where, themeKeys: { hasSome: [...keys] } };
}
function kindOf(row) {
    if (row.quote.type === QuoteType.QURAN_VERSE)
        return 'verse';
    if (row.quote.type !== QuoteType.HADITH)
        return null;
    if (!row.quote.isAthar)
        return 'hadith';
    return row.quote.atharReviewDecision === 'KEEP' ? 'athar' : null;
}
function distinctQuotes(keys, quotesByKey) {
    if (keys.length === 1)
        return quotesByKey.get(keys[0])?.size ?? 0;
    const union = new Set();
    for (const key of keys)
        for (const id of quotesByKey.get(key) ?? [])
            union.add(id);
    return union.size;
}
export async function summariseThemes(prisma, sides, themes, active) {
    if (themes.length === 0)
        return { themes: [], countsByKind: null };
    const keys = themes.flatMap((theme) => theme.keys);
    const [sinRows, deedRows] = await Promise.all([
        sides.sin ? prisma.sinQuote.findMany({ where: withKeys(sides.sin, keys), select: SUMMARY_SELECT }) : Promise.resolve([]),
        sides.deed ? prisma.goodDeedQuote.findMany({ where: withKeys(sides.deed, keys), select: SUMMARY_SELECT }) : Promise.resolve([]),
    ]);
    const rows = [...sinRows, ...deedRows];
    const quotesByKey = new Map();
    for (const row of rows) {
        for (const key of row.themeKeys ?? [])
            quotesByKey.set(key, (quotesByKey.get(key) ?? new Set()).add(row.quoteId));
    }
    let countsByKind = null;
    if (active) {
        const seen = new Set();
        const counts = { verse: 0, hadith: 0, athar: 0 };
        for (const row of rows) {
            if (!(row.themeKeys ?? []).some((key) => active.keys.includes(key)) || seen.has(row.quoteId))
                continue;
            seen.add(row.quoteId);
            const kind = kindOf(row);
            if (kind)
                counts[kind] += 1;
        }
        countsByKind = { all: counts.verse + counts.hadith + counts.athar, ...counts };
    }
    return {
        themes: themes.map((theme) => ({
            key: theme.key,
            ar: theme.ar,
            en: theme.en,
            count: distinctQuotes(theme.keys, quotesByKey),
        })),
        countsByKind,
    };
}
export async function readThemedPage(prisma, sides, options) {
    const [sinRanked, deedRanked] = await Promise.all([
        sides.sin ? prisma.sinQuote.findMany({ where: sides.sin, select: READING_SELECT }) : Promise.resolve([]),
        sides.deed ? prisma.goodDeedQuote.findMany({ where: sides.deed, select: READING_SELECT }) : Promise.resolve([]),
    ]);
    const merged = dedupeReading([...sinRanked, ...deedRanked]);
    const countsByType = { QURAN_VERSE: 0, HADITH: 0, SCHOLAR_QUOTE: 0, BOOK_EXCERPT: 0 };
    for (const row of merged)
        countsByType[row.quote.type] = (countsByType[row.quote.type] ?? 0) + 1;
    const pageRows = merged.slice((options.page - 1) * options.limit, options.page * options.limit);
    const full = await options.hydrate(pageRows);
    return {
        items: full.map((row) => options.present(row)),
        total: merged.length,
        countsByType,
    };
}
//# sourceMappingURL=theme-reading.js.map