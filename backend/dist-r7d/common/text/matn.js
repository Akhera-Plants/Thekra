const MARKS = /[\u064B-\u0652\u0670\u06D6-\u06ED]/;
function foldChar(ch) {
    if (MARKS.test(ch) || ch === '\u0640')
        return '';
    if (ch === '\u0623' || ch === '\u0625' || ch === '\u0622' || ch === '\u0671')
        return '\u0627';
    if (ch === '\u0649')
        return '\u064A';
    if (ch === '\u0629')
        return '\u0647';
    return ch;
}
function foldWithMap(input) {
    let text = '';
    const map = [];
    for (let index = 0; index < input.length; index += 1) {
        const folded = foldChar(input[index] ?? '');
        for (const ch of folded) {
            text += ch;
            map.push(index);
        }
    }
    return { text, map };
}
const LETTER = '[\\u0621-\\u064A\\u066E-\\u06D3]';
const WORD_START = `(?<!${LETTER})`;
const WORD_END = `(?!${LETTER})`;
const NAME = `(?:رسول\\s+الله|النبي|نبي\\s+الله)${WORD_END}`;
const SALAWAT = `(?:[(\\[]\\s*)?(?:صلي\\s+الله\\s+عليه(?:\\s+و(?:اله\\s+)?سلم)?|عليه\\s+الصلاه\\s+والسلام|\\uFDFA)${WORD_END}(?:\\s*[)\\]])?`;
const SPEECH = `(?:انه\\s+قال|قال|يقول|تقول)${WORD_END}`;
const LEAD = `${WORD_START}(?:[فو])?(?:سمعت|سمعنا|سال|سالت|سالوا|قالت|يقول|تقول|قالوا|قال|قلت|عن|ان)${WORD_END}`;
const CUE = new RegExp(`${LEAD}\\s+(?:يا\\s+)?${NAME}(?:\\s+${SALAWAT})?(?:\\s+${SPEECH})?`, 'g');
const PROPHETIC = new RegExp(`${WORD_START}(?:يا\\s+)?${NAME}(?:\\s+${SALAWAT})?\\s+${SPEECH}`, 'g');
const TRANSMISSION = /^(?:و)?(?:حدثنا|حدثني|اخبرنا|اخبرني|انبانا|انباني)(?![\u0600-\u06FF])/;
const MIN_MATN_LETTERS = 8;
function letterCount(value) {
    return (value.match(/[\u0600-\u06FF]/g) ?? []).length;
}
export function stripFootnotes(value) {
    return value.replace(/\\+\s*\d+\s*\\+/g, ' ').replace(/\s+/g, ' ').trim();
}
function sliceAt(trimmed, map, foldedEnd) {
    const origin = foldedEnd >= map.length ? trimmed.length : (map[foldedEnd] ?? trimmed.length);
    const matnText = stripFootnotes(trimmed.slice(origin).replace(/^[\s:：،,.\-–—]+/, ''));
    return { isnadText: stripFootnotes(trimmed.slice(0, origin)), matnText };
}
function usable(split) {
    return letterCount(split.matnText) >= MIN_MATN_LETTERS && !TRANSMISSION.test(foldWithMap(split.matnText).text);
}
export function splitMatn(narration) {
    const trimmed = stripFootnotes(narration.trim());
    const { text, map } = foldWithMap(trimmed);
    const ends = [];
    for (const pattern of [CUE, PROPHETIC]) {
        for (const match of text.matchAll(pattern)) {
            ends.push((match.index ?? 0) + match[0].length);
        }
    }
    ends.sort((a, b) => b - a);
    for (const foldedEnd of ends) {
        const split = sliceAt(trimmed, map, foldedEnd);
        if (usable(split))
            return split;
    }
    const continues = /^(?:و)?(?:حدثنا|حدثني|اخبرنا|اخبرني|انبانا|انباني|سمعت|عن)(?![\u0600-\u06FF])/;
    for (const match of text.matchAll(/(?<![\u0621-\u064A])(?:فقالت|فقالوا|فقالا|فقال|وقالت|وقالوا|وقال|فيقول|قالت|قالوا|قالا|يقول|تقول|قال)(?![\u0621-\u064A])/g)) {
        const after = text.slice((match.index ?? 0) + match[0].length).replace(/^[\s:،,."«»]+/, '');
        if (continues.test(after))
            continue;
        const split = sliceAt(trimmed, map, (match.index ?? 0) + match[0].length);
        if (usable(split))
            return split;
    }
    if (TRANSMISSION.test(text)) {
        const quoteAt = text.search(/[«"']/);
        if (quoteAt > 0) {
            const split = sliceAt(trimmed, map, quoteAt);
            if (usable(split))
                return split;
        }
    }
    return { isnadText: '', matnText: trimmed };
}
export const CONTEXT_MAX_WORDS = 200;
function foldToken(word) {
    let out = '';
    for (const ch of word)
        out += foldChar(ch);
    return out
        .replace(/\u0626/g, '\u064A')
        .replace(/\u0624/g, '\u0648')
        .replace(/[^\u0621-\u064A0-9]/g, '');
}
function tokenize(text) {
    const tokens = [];
    for (const match of text.matchAll(/\S+/g)) {
        tokens.push({ start: match.index ?? 0, raw: match[0].replace(/[\u064B-\u0652\u0670\u0640]/g, ''), folded: foldToken(match[0]) });
    }
    return tokens;
}
const PROPHET_WORDS = new Set(['رسول', 'النبي', 'نبي', 'للنبي', 'لرسول', 'بالنبي', 'برسول']);
const CHAIN_VERBS = new Set([
    'حدثنا', 'حدثني', 'اخبرنا', 'اخبرني', 'انبانا', 'انباني', 'وحدثنا', 'وحدثني', 'واخبرنا', 'واخبرني',
    'حدثناه', 'وحدثناه', 'حدثنيه', 'وحدثنيه', 'اخبرناه', 'واخبرناه', 'ثنا', 'نا',
]);
const HEARD = new Set(['سمعت', 'سمعنا', 'سمع']);
const ABOUT = new Set(['عن', 'وعن', ...HEARD]);
const THAT = new Set(['ان', 'وان']);
const NAME_END = new Set([
    'قال', 'قالت', 'يقول', 'تقول', 'ان', 'انه', 'انها', 'عن', 'رضي', 'حدثه', 'اخبره', 'يحدث', 'يحدثه', 'سمع',
    'سمعت', 'قالا', 'قالوا', 'حدثهم', 'يخبر', 'وهو', 'زوج', 'انهم', 'انهما',
]);
const REPORTS = new Set([
    'قال', 'قالت', 'يقول', 'تقول', 'اخبره', 'حدثه', 'اخبرهم', 'حدثهم', 'اخبرني', 'حدثني', 'سمع', 'قالا', 'يحدث',
    'اخبرته', 'حدثته', 'كان', 'كانت',
]);
const OBEISANCE = new Set(['رضي', 'الله', 'عنه', 'عنها', 'عنهما', 'عنهم']);
const NOT_NAMES = new Set([
    'في', 'قال', 'لا', 'ان', 'ما', 'ثم', 'فقال', 'انه', 'من', 'لم', 'اذا', 'يا', 'رجل', 'رجلا', 'رجالا', 'امراه',
    'ناسا', 'اناسا', 'قوما', 'اعرابيا', 'اهل', 'عند', 'مع', 'قد', 'غير', 'هو', 'هي', 'ذلك', 'هذا', 'هذه', 'شيء', 'شي',
    'امر', 'حديث', 'قول', 'الصلاه', 'نفسه', 'نفسي', 'بعض', 'قوله', 'كان', 'كانت', 'كنا', 'كنت', 'نحن', 'انا',
    'ابيه', 'اباه', 'ابوه', 'امه', 'جده', 'جدته', 'عمه', 'خاله', 'اخيه', 'اخاه', 'اخوه', 'ابنه', 'مولاه',
]);
const AFTER_ARTICLE_NAME = new Set([
    'بن', 'ابن', 'رضي', 'قال', 'قالت', 'يقول', 'عن', 'ان', 'انه', 'انها', 'حدثه', 'اخبره', 'سمع', 'سمعت', 'يحدث',
]);
function nameEnd(folded, from, span) {
    for (let index = from; index < folded.length && index - from < span; index += 1) {
        if (NAME_END.has(folded[index] ?? ''))
            return index;
    }
    return -1;
}
const SENTENCE_MARK = /[؟?!«»"“”]|\.$/;
function plainName(raws, from, to) {
    return raws.length === 0 || !raws.slice(from, to).some((raw) => SENTENCE_MARK.test(raw));
}
function isNarratorLink(folded, index, raws = []) {
    const word = folded[index] ?? '';
    const next = folded[index + 1] ?? '';
    if (!next || PROPHET_WORDS.has(next) || NOT_NAMES.has(next))
        return false;
    if (CHAIN_VERBS.has(word))
        return true;
    if (ABOUT.has(word)) {
        if (next.startsWith('ال') && !AFTER_ARTICLE_NAME.has(folded[index + 2] ?? ''))
            return false;
        const end = nameEnd(folded, index + 2, 6);
        return end >= 0 && plainName(raws, index + 1, end);
    }
    if (THAT.has(word)) {
        if (/^و?إ/.test(raws[index] ?? ''))
            return false;
        const end = nameEnd(folded, index + 2, 5);
        if (end < 0 || !plainName(raws, index + 1, end))
            return false;
        let after = end;
        while (after < folded.length && OBEISANCE.has(folded[after] ?? ''))
            after += 1;
        return REPORTS.has(folded[after] ?? '');
    }
    return false;
}
function opensChain(folded, index) {
    const word = folded[index] ?? '';
    return CHAIN_VERBS.has(word) && index > 0 && (folded[index - 1] === 'ح' || word.startsWith('و'));
}
function skipsOnlyChain(span) {
    const tokens = tokenize(span).filter((token) => token.folded);
    const folded = tokens.map((token) => token.folded);
    const raws = tokens.map((token) => token.raw);
    if (folded.length === 0)
        return true;
    let gap = 0;
    let first = -1;
    for (let index = 0; index < folded.length; index += 1) {
        const word = folded[index] ?? '';
        const chain = word === 'ح' || CHAIN_VERBS.has(word) || isNarratorLink(folded, index, raws);
        if (chain && first < 0)
            first = index;
        gap = chain || NAME_END.has(word) ? 0 : gap + 1;
        if (gap > 8)
            return false;
    }
    return first >= 0 && first <= 3;
}
function contextStart(text, matnAt) {
    const tokens = tokenize(text);
    const folded = tokens.map((token) => token.folded);
    const raws = tokens.map((token) => token.raw);
    const after = (index) => {
        const offset = tokens[index]?.start ?? text.length;
        return offset <= matnAt || skipsOnlyChain(text.slice(matnAt, offset));
    };
    const firstMention = folded.findIndex((word) => PROPHET_WORDS.has(word));
    const matnToken = tokens.findIndex((token) => token.start >= matnAt);
    const chainsEnd = firstMention >= 0 ? Math.max(firstMention, matnToken < 0 ? 0 : matnToken) : folded.length;
    let from = 0;
    for (let index = 1; index < chainsEnd; index += 1) {
        if (opensChain(folded, index) && after(index))
            from = index;
    }
    const mention = folded.findIndex((word, index) => index >= from && PROPHET_WORDS.has(word));
    const limit = mention >= 0 ? mention : folded.length;
    const links = [];
    for (let index = from; index < limit; index += 1) {
        if (isNarratorLink(folded, index, raws))
            links.push(index);
    }
    for (let last = links.length - 1; last >= 0; last -= 1) {
        let at = last;
        while (HEARD.has(folded[links[at] ?? 0] ?? '') && at > 0)
            at -= 1;
        let start = links[at] ?? 0;
        if (CHAIN_VERBS.has(folded[start] ?? ''))
            start += 1;
        if (start < tokens.length && after(start))
            return tokens[start]?.start ?? null;
    }
    return null;
}
function wordCount(value) {
    return value.split(/\s+/).filter(Boolean).length;
}
export function contextMatn(narration) {
    const trimmed = stripFootnotes(narration.trim());
    const split = splitMatn(trimmed);
    const matnAt = split.isnadText ? Math.max(0, trimmed.lastIndexOf(split.matnText)) : trimmed.length;
    const start = contextStart(trimmed, matnAt);
    if (start === null)
        return split.matnText;
    const context = trimmed.slice(start).replace(/^[\s:：،,.\-–—]+/, '').trim();
    if (!usable({ isnadText: '', matnText: context }))
        return split.matnText;
    return context;
}
export function displayMatn(narration) {
    const context = contextMatn(narration);
    if (wordCount(context) > CONTEXT_MAX_WORDS)
        return splitMatn(narration).matnText;
    return context;
}
const CUT_SUFFIX = /^(?:ا|وا|ت|ن|ون|ي)(?![\u0621-\u064A])/;
export function joinNarration(isnadText, matnText) {
    const isnad = isnadText.trim();
    const matn = matnText.trim();
    if (!isnad)
        return matn;
    if (!matn)
        return isnad;
    const lastWord = foldToken(isnad.split(/\s+/).at(-1) ?? '');
    if (/(?:قال|يقول|تقول)$/.test(lastWord) && CUT_SUFFIX.test(foldWithMap(matn).text))
        return `${isnad}${matn}`;
    return `${isnad} ${matn}`;
}
const NOT_A_LEAD = new Set([
    'كان', 'كانت', 'قال', 'قالت', 'يقول', 'تقول', 'صلي', 'ثم', 'فقال', 'وقال', 'اذا', 'لما', 'بينما', 'بينا', 'روينا', 'وروينا',
]);
const SPEECH_VERBS = new Set(['يقول', 'تقول', 'يكون']);
const LEAD_REPORTS = new Set([...REPORTS, 'ان', 'انه', 'انها', 'انهم', 'انهما', 'عن', 'سمعت', 'سمعنا', 'سمعا', 'يقول']);
export function startsWithNarratorLead(text) {
    const tokens = tokenize(stripFootnotes(text.trim())).filter((token) => token.folded);
    const folded = tokens.map((token) => token.folded);
    const raws = tokens.map((token) => token.raw);
    const first = folded[0] ?? '';
    if (folded.length < 3 || /^[«"“(\[{﴿]/.test(raws[0] ?? ''))
        return false;
    if (ABOUT.has(first))
        return !PROPHET_WORDS.has(folded[1] ?? '');
    if (THAT.has(first))
        return isNarratorLink(folded, 0, raws);
    if (CHAIN_VERBS.has(first) || PROPHET_WORDS.has(first) || NOT_NAMES.has(first) || NOT_A_LEAD.has(first))
        return false;
    for (let index = 1; index < Math.min(folded.length, 10); index += 1) {
        if (SENTENCE_MARK.test(raws[index - 1] ?? '') || PROPHET_WORDS.has(folded[index] ?? ''))
            return false;
        const word = folded[index] ?? '';
        if (LEAD_REPORTS.has(word))
            return !(word.startsWith('ان') && SPEECH_VERBS.has(folded[index + 1] ?? ''));
    }
    return false;
}
export function matnForMatching(row) {
    const stored = row.matnAr?.trim();
    if (stored) {
        if (!startsWithNarratorLead(stored))
            return stored;
        return splitMatn(stored).matnText || stored;
    }
    return splitMatn(row.textAr).matnText || row.textAr;
}
//# sourceMappingURL=matn.js.map