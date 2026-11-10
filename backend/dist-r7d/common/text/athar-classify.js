const MARKS = /[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/g;
export function foldArabic(input) {
    return input
        .replace(MARKS, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/\s+/g, ' ')
        .trim();
}
export function stripOcrNoise(input) {
    return input
        .replace(/\[\s*\$\s*\]/g, ' ')
        .replace(/\[\s*\]/g, ' ')
        .replace(/\|+/g, ' ')
        .replace(/\{\s*\}/g, ' ')
        .replace(/[\$#~^]+/g, ' ')
        .replace(/(?:^|\s)[\d\u0660-\u0669]{1,4}(?:\s|$)/g, ' ')
        .replace(/\(\s*[\d\u0660-\u0669]+\s*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
const OCR_RESIDUAL = /[\[\]\{\}\|\$~^]|\bms\d+\b|PageV\d+P\d+/i;
function arabicLetters(text) {
    return (text.match(/[\u0621-\u064A]/g) ?? []).length;
}
const PROPHET_NAME = '(?:رسول\\s+الله|النبي|نبي\\s+الله)';
const SALAWAT = '(?:صلي\\s+الله\\s+عليه(?:\\s+و(?:اله\\s+)?سلم)?|عليه\\s+الصلاه\\s+والسلام)';
const EDGE = '(?:^|[^\\u0600-\\u06FF])';
const EDGE_END = '(?:$|[^\\u0600-\\u06FF])';
const MARFU_CUES = [
    new RegExp(`${EDGE}و?رفعه${EDGE_END}`),
    new RegExp(`${EDGE}و?يرفعه${EDGE_END}`),
    new RegExp(`${EDGE}و?مرفوعا${EDGE_END}`),
    new RegExp(`${EDGE}يبلغ\\s+به(?:\\s+النبي)?${EDGE_END}`),
    new RegExp(`${EDGE}روايه${EDGE_END}`),
    new RegExp(`قال\\s+${PROPHET_NAME}`),
    new RegExp(`يقول\\s+${PROPHET_NAME}`),
    new RegExp(`عن\\s+${PROPHET_NAME}`),
    new RegExp(`ان\\s+${PROPHET_NAME}`),
    new RegExp(`سمعت\\s+${PROPHET_NAME}`),
    new RegExp(`يا\\s+${PROPHET_NAME}`),
    new RegExp(`${PROPHET_NAME}\\s+${SALAWAT}\\s*(?:قال|يقول)?`),
    /صلي الله عليه وسلم\s*(?:قال|يقول)/,
    new RegExp(`${PROPHET_NAME}\\s+${SALAWAT}`),
    /صلي\s+الله\s+عليه(?:\s+و(?:اله\s+)?سلم)?/,
    /عليه\s+الصلاه\s+والسلام/,
    new RegExp(`${EDGE}[وف]?نهينا${EDGE_END}`),
    new RegExp(`${EDGE}[وف]?امرنا${EDGE_END}`),
    new RegExp(`${EDGE}[وف]?امر\\s+الناس${EDGE_END}`),
    /كنا\s+ن(?:ؤمر|ومر)/,
    /كنا\s+ننهي/,
    /من\s+السنه/,
];
const NAME_CHUNK = '(?!ل|عن|ان|قال|يقول|قالت|سمعت|ثنا|انا)[^\\s،,؛:：«»"\\[\\]|]+';
const PERSON = `(?:ال|ابن|ابي|أبو|ام)?${NAME_CHUNK}` +
    `(?:\\s+(?:بن|ابن|بنت)\\s+(?:ال|ابي|أبو|ام)?${NAME_CHUNK}|\\s+(?:ال|ابي|أبو|ام)?${NAME_CHUNK}){0,5}`;
const HONORIFIC = '(?:\\s+رضي\\s+الله\\s+عن[هها]|\\s+رضي\\s+الله\\s+عنهم|\\s+رحمه\\s+الله|\\s+رحمها\\s+الله|\\s+رضوان\\s+الله\\s+عليه)?';
const QALA = 'ف?(?:قال|يقول|قالت)';
const QUOTE_INTRO = new RegExp(`(?:^|[\\s،,])(?:${QALA})\\s+(${PERSON})${HONORIFIC}(?:\\s+ل(?:ـ)?${PERSON})?\\s*([:：]|«|"|”|„)`, 'g');
const SAID_TO_INTRO = new RegExp(`(?:^|[\\s،,])ان\\s+(${PERSON})${HONORIFIC}\\s+${QALA}\\s+ل(?:ـ)?${PERSON}\\s*([:：]|«|"|”|„)`, 'g');
const AN_QALA_INTRO = new RegExp(`(?:^|[\\s،,])عن\\s+(${PERSON})${HONORIFIC}\\s*(?:،|,)?\\s*${QALA}\\s*([:：]|«|"|”|„)`, 'g');
const SAYS_INTRO = new RegExp(`(?:^|[\\s،,])سمعت\\s+(${PERSON})${HONORIFIC}\\s+يقول\\s*([:：]|«|"|”|„)?`, 'g');
function cleanSpeaker(raw) {
    return raw
        .replace(/[،,؛]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^ل+/, '')
        .replace(/\s+(?:رضي الله عنه|رضي الله عنها|رحمه الله|رحمها الله|رضوان الله عليه)\s*$/g, '')
        .trim();
}
function findQuoteHits(text) {
    const folded = foldArabic(text);
    const hits = [];
    const collect = (pattern, speakerGroup) => {
        pattern.lastIndex = 0;
        for (const match of folded.matchAll(pattern)) {
            const name = cleanSpeaker(match[speakerGroup] ?? '');
            if (name.length < 2)
                continue;
            if (/رسول الله|النبي|نبي الله/.test(name))
                continue;
            const full = match[0] ?? '';
            const sayingStart = (match.index ?? 0) + full.length;
            hits.push({ speakerRaw: name, sayingStart, index: match.index ?? 0 });
        }
    };
    collect(QUOTE_INTRO, 1);
    collect(SAID_TO_INTRO, 1);
    collect(AN_QALA_INTRO, 1);
    SAYS_INTRO.lastIndex = 0;
    for (const match of folded.matchAll(SAYS_INTRO)) {
        const name = cleanSpeaker(match[1] ?? '');
        if (name.length < 2)
            continue;
        if (/رسول الله|النبي|نبي الله/.test(name))
            continue;
        const full = match[0] ?? '';
        let sayingStart = (match.index ?? 0) + full.length;
        hits.push({ speakerRaw: name, sayingStart, index: match.index ?? 0 });
    }
    return hits;
}
function extractSaying(folded, start) {
    let saying = folded.slice(start).trim();
    saying = saying.replace(/^[:：«"”„]\s*/, '');
    const cut = saying.search(/\s(?:حدثنا|حدثني|اخبرنا|اخبرني|انا\s+[ا-ي]|ثنا\s+[ا-ي])\s/);
    if (cut > 40)
        saying = saying.slice(0, cut).trim();
    return saying;
}
function isEmptySaying(saying) {
    const stripped = saying
        .replace(/[«»"“”„:：،,.ـ_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return arabicLetters(stripped) < 12;
}
function isIsnadContinuation(saying) {
    return /^(?:و)?(?:حدثنا|حدثني|اخبرنا|اخبرني|انا|ثنا)(?:\s|$)/.test(saying.trim());
}
function isAmbiguousShortSpeaker(speakerRaw, folded, hitIndex) {
    const core = foldArabic(speakerRaw);
    if (/\s/.test(core))
        return false;
    if (!/^(علي|عمر|حسن|انس|مجاهد|قتاده)$/.test(core))
        return false;
    const before = folded.slice(0, hitIndex);
    const foreignNasab = new RegExp(`${core}\\s+بن\\s+(?!ابي\\s+طالب|ابي\\s+طالب|الخطاب|مالك|جبر|دعامه)`);
    return foreignNasab.test(before);
}
function isChainOnly(folded) {
    if (/عن\s+[\u0600-\u06FF\s]{2,40}(?:قال|يقول|قالت)?\s*$/.test(folded) && !/[:：«"]/.test(folded)) {
        return true;
    }
    if (/(?:قال|يقول|قالت)\s+[\u0600-\u06FF\s]{2,40}$/.test(folded) && arabicLetters(folded) < 80) {
        const hits = findQuoteHits(folded + '«x»');
        void hits;
    }
    if (/(?:^|[\s،,])(?:قال|يقول|قالت)\s+[\u0600-\u06FF][\u0600-\u06FF\s]{1,40}$/.test(folded) &&
        !/[:：«"]/.test(folded)) {
        return true;
    }
    return false;
}
function isMarfu(folded) {
    for (const cue of MARFU_CUES) {
        if (cue.test(folded))
            return true;
    }
    if (new RegExp(PROPHET_NAME).test(folded))
        return true;
    return false;
}
export function classifyNarration(text) {
    const stripped = stripOcrNoise(text.replace(/\s+/g, ' ').trim());
    if (!stripped)
        return { kind: 'REJECT', speakerRaw: null, saying: null };
    if (OCR_RESIDUAL.test(stripped)) {
        return { kind: 'REJECT', speakerRaw: null, saying: null };
    }
    const folded = foldArabic(stripped);
    if (!folded)
        return { kind: 'REJECT', speakerRaw: null, saying: null };
    if (isMarfu(folded)) {
        return { kind: 'MARFU', speakerRaw: null, saying: null };
    }
    if (isChainOnly(folded)) {
        return { kind: 'REJECT', speakerRaw: null, saying: null };
    }
    const hits = findQuoteHits(folded);
    if (hits.length === 0) {
        return { kind: 'REJECT', speakerRaw: null, saying: null };
    }
    hits.sort((a, b) => a.index - b.index);
    const viable = [];
    for (const hit of hits) {
        if (isAmbiguousShortSpeaker(hit.speakerRaw, folded, hit.index))
            continue;
        const candidate = extractSaying(folded, hit.sayingStart);
        if (isEmptySaying(candidate) || isIsnadContinuation(candidate))
            continue;
        viable.push({ hit, saying: candidate });
    }
    if (viable.length === 0) {
        return { kind: 'REJECT', speakerRaw: null, saying: null };
    }
    const maxLen = Math.max(...viable.map((v) => v.saying.length));
    const threshold = Math.max(40, Math.floor(maxLen * 0.5));
    let chosen = viable[0];
    for (let i = viable.length - 1; i >= 0; i--) {
        const v = viable[i];
        if (v.saying.length >= threshold) {
            chosen = v;
            break;
        }
    }
    const saying = chosen.saying;
    if (isMarfu(saying)) {
        return { kind: 'MARFU', speakerRaw: null, saying: null };
    }
    return {
        kind: 'ATHAR',
        speakerRaw: chosen.hit.speakerRaw,
        saying,
    };
}
const STORY_CUTS = [
    /قال\s*[:：]?\s*و(?:حدثنا|حدثني|اخبرنا|اخبرني|انبانا|ثنا)\s/,
    /(?:^|\s)و?(?:حدثنا|حدثني|اخبرنا|اخبرني|انبانا)\s/,
    /هكذا\s+جاء/,
    /(?:^|\s)و?هكذا\s+موقوف/,
    /هذا\s+اسناد/,
    /(?:^|\s)و?هذا\s+موقوف/,
    /(?:^|\s)و?هذا\s+مرسل/,
    /(?:^|\s)و?هذا\s+منقطع/,
    /(?:^|\s)و?اسناده(?:\s|$)/,
    /(?:^|\s)و?رواه\s/,
    /(?:^|\s)و?روي(?:\s|$)/,
    /اخرج[هة]\s/,
    /فصل\s+في/,
    /(?:^|\s)باب\s+/,
];
const STORY_OCR = /[\[\]{}|~$^]|:\s*:|PageV\d+P\d+|\[\s*\$\s*\]/i;
function foldWithMap(input) {
    const chars = [];
    const rawMap = [];
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/.test(ch))
            continue;
        let out = ch;
        if (/[أإآٱ]/.test(ch))
            out = 'ا';
        else if (ch === 'ى')
            out = 'ي';
        else if (ch === 'ة')
            out = 'ه';
        chars.push(out);
        rawMap.push(i);
    }
    let folded = '';
    const toOrig = [];
    let prevSpace = false;
    for (let i = 0; i < chars.length; i++) {
        const space = /\s/.test(chars[i]);
        if (space) {
            if (prevSpace || folded.length === 0)
                continue;
            folded += ' ';
            toOrig.push(rawMap[i]);
            prevSpace = true;
            continue;
        }
        folded += chars[i];
        toOrig.push(rawMap[i]);
        prevSpace = false;
    }
    if (folded.endsWith(' ')) {
        folded = folded.slice(0, -1);
        toOrig.pop();
    }
    return { folded, toOrig };
}
function frameAt(folded, matchIndex) {
    const rel = folded.slice(matchIndex).search(/[^\s،,]/);
    return matchIndex + (rel < 0 ? 0 : rel);
}
function isHandoff(folded, hit, next) {
    const between = folded.slice(hit.sayingStart, next.index).replace(/[«»"“”„:：\s]/g, '');
    return between.length === 0;
}
function earliestCut(region) {
    let cut = region.length;
    for (const pattern of STORY_CUTS) {
        const at = region.search(pattern);
        if (at >= 0 && at < cut)
            cut = at;
    }
    return cut;
}
function isOnlyFrame(body) {
    const t = body.replace(/[«»"“”„]/g, '').trim();
    if (!t)
        return true;
    return /^(?:ف?(?:قال|يقول|قالت)|سمعت)\s+\S.{0,50}$/.test(t) && !/[:：]/.test(t);
}
const STORY_GAP = /(?:\.\s*){3,}|\u2026/;
const STORY_GESTURE = /(?:^|[^\u0600-\u06FF])[وف]?(?:اوما|اشار)(?:[^\u0600-\u06FF]|$)/;
function isMidDialogue(body) {
    const t = body.replace(/^[«"\s]+/, '');
    if (/^[^«"]{0,48}[؟?][»"\s]*(?:قالت|قال|فقال|فقالت)\s*[:：]/.test(t))
        return true;
    if (/^و(?:ما|هل|اين|كيف)\s+\S/.test(t) && /[؟?]\s*$/.test(t) && t.length < 60)
        return true;
    return false;
}
function attributionOf(body) {
    const t = body.replace(/^[«"\s]+/, '');
    if (/^(?:دخل|اتي|مر|خرج|جاء|لقي|سالت|سئل|بينما|بينا|قام)\s+/.test(t))
        return 'NARRATED';
    if (/^مررنا\s+/.test(t))
        return 'NARRATED';
    if (/^رايت\s+(?!ان|ما\s)/.test(t))
        return 'NARRATED';
    if (/^(?:ف)?(?:قال|قالت|يقول)\s+(?:لي\s+)?/.test(t))
        return 'NARRATED';
    if (/^ما\s+(?:اكل|دخل|كان|قال|خرج|مر|شبع|لبس)\s+/.test(t))
        return 'NARRATED';
    if (/^(?:كان|كانت)\s+(?!ي|ت|ن|ربما|الرجل|المؤمن|الانسان|العبد|احد)/.test(t)) {
        return 'NARRATED';
    }
    if (/^.{0,100}[؟?][،,\s«"]*(?:قال|قالت|فقال|فقالت)\s*[:：]/.test(t))
        return 'NARRATED';
    return 'SAID';
}
const CONTENT_EXCLUSIONS = [
    { label: 'أعينوا عباد الله', pattern: /اعينوا\s+عباد\s+الله/ },
    { label: 'يا فلان أغثني', pattern: /يا\s+(?!الله(?:\s|$))[\u0600-\u06FF]+\s+اغثني/ },
    { label: 'العمالقة', pattern: /العمالقه/ },
    { label: 'بني إسرائيل', pattern: /بني\s+اسرائيل/ },
    { label: 'في الكتب الأولى', pattern: /في\s+الكتب\s+الاولي/ },
];
export function atharContentCue(text) {
    const folded = foldArabic(text);
    for (const item of CONTENT_EXCLUSIONS) {
        if (item.pattern.test(folded))
            return item.label;
    }
    return null;
}
function rejected(reason) {
    return { kept: false, reason, text: null, speakerRaw: null, attribution: null };
}
export function extractAtharStory(text) {
    const cleaned = stripOcrNoise(text.replace(/\s+/g, ' ').trim());
    if (!cleaned)
        return rejected('short');
    const { folded, toOrig } = foldWithMap(cleaned);
    const hits = findQuoteHits(folded).sort((a, b) => a.index - b.index);
    if (hits.length === 0)
        return rejected('frame-only');
    let start = hits[0];
    for (let i = 0; i < hits.length - 1; i++) {
        const hit = hits[i];
        const next = hits[i + 1];
        if (!isHandoff(folded, hit, next))
            break;
        start = next;
    }
    const origin = frameAt(folded, start.index);
    const region = folded.slice(start.sayingStart);
    const cutRel = earliestCut(region);
    const cutAbs = start.sayingStart + cutRel;
    const origStart = toOrig[origin] ?? 0;
    const origEnd = cutAbs >= folded.length ? cleaned.length : (toOrig[cutAbs] ?? cleaned.length);
    const story = cleaned
        .slice(origStart, origEnd)
        .replace(/[«»"“”„\s،,]+$/g, '')
        .trim();
    const bodyStart = toOrig[start.sayingStart] ?? origStart;
    const body = cleaned
        .slice(bodyStart, origEnd)
        .replace(/^[«»"“”„:：\s]+/, '')
        .replace(/[«»"“”„\s،,]+$/g, '')
        .trim();
    const bodyFolded = foldArabic(body);
    if (STORY_OCR.test(story) || STORY_OCR.test(body))
        return rejected('ocr');
    if (isOnlyFrame(bodyFolded))
        return rejected('frame-only');
    if (body.length < 25)
        return rejected('short');
    if (isMidDialogue(bodyFolded))
        return rejected('mid-dialogue');
    if (STORY_GESTURE.test(bodyFolded))
        return rejected('gesture');
    if (STORY_GAP.test(story) || STORY_GAP.test(body))
        return rejected('gap');
    if (atharContentCue(bodyFolded))
        return rejected('content');
    return {
        kept: true,
        text: story,
        speakerRaw: start.speakerRaw,
        attribution: attributionOf(bodyFolded),
    };
}
function coreName(folded) {
    return folded
        .replace(/^(?:عن|قال|يقول|قالت)\s+/g, '')
        .replace(/\s+(?:قال|يقول|قالت)$/g, '')
        .replace(/^(?:ابا|ابي|ابو)\s+/, 'ابو ')
        .replace(/\s+/g, ' ')
        .trim();
}
export function matchAtharSpeaker(speakerRaw, speakers) {
    if (!speakerRaw)
        return null;
    const folded = foldArabic(speakerRaw);
    const core = coreName(folded);
    const coreHasNasab = /(?:^|\s)(?:بن|ابن|بنت)\s/.test(core);
    let best = null;
    let bestLen = 0;
    for (const entry of speakers) {
        const entryForms = entry.forms.map((form) => foldArabic(form)).filter(Boolean);
        const entryFull = entryForms.filter((form) => /(?:بن|ابن|بنت)\s/.test(form));
        for (const ff of entryForms) {
            const formCore = coreName(ff);
            if (!ff)
                continue;
            const formIsShort = !/\s/.test(formCore);
            if (formIsShort) {
                if (core !== formCore && folded !== ff)
                    continue;
                if (coreHasNasab) {
                    const nasabOk = entryFull.some((full) => core === full || core.startsWith(`${full} `) || full.startsWith(core));
                    if (!nasabOk)
                        continue;
                }
            }
            const restAfterForm = core.startsWith(`${formCore} `)
                ? core.slice(formCore.length + 1)
                : '';
            const restIsHonorific = /^(?:رضي|رحم|رضوان)/.test(restAfterForm);
            const coreIsListedForm = entryForms.some((f) => coreName(f) === core);
            const prefixOk = !formIsShort &&
                formCore.length >= 3 &&
                restAfterForm.length > 0 &&
                (restIsHonorific || coreIsListedForm);
            const hit = folded === ff ||
                core === formCore ||
                prefixOk ||
                (!formIsShort && formCore.length >= 3 && core.endsWith(` ${formCore}`));
            if (!hit)
                continue;
            const score = Math.max(folded === ff ? ff.length + 2 : 0, core === formCore ? formCore.length + 2 : 0, hit ? formCore.length : 0);
            if (score > bestLen) {
                bestLen = score;
                best = { key: entry.key, ar: entry.ar };
            }
        }
    }
    return best;
}
//# sourceMappingURL=athar-classify.js.map