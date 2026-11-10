import { HadithGrade } from '@prisma/client';
export const ARNAUT_NAME = 'شعيب الأرنؤوط';
export const SUNAN_SCHOLAR_NAMES = {
    'Shuaib Al Arnaut': ARNAUT_NAME,
};
export const SUNAN_BOOK_TITLES = {
    abudawud: 'سنن أبي داود',
    ibnmajah: 'سنن ابن ماجه',
    tirmidhi: 'سنن الترمذي',
};
const APPROPRIATE = {
    sahih: HadithGrade.SAHIH,
    'sahih lighairihi': HadithGrade.SAHIH,
    hasan: HadithGrade.HASAN,
    'hasan sahih': HadithGrade.HASAN,
    'hasan lighairihi': HadithGrade.HASAN,
};
const SCHOLAR_ORDER = ['Shuaib Al Arnaut'];
const BOOK_ORDER = ['abudawud', 'ibnmajah', 'tirmidhi'];
export const OUTSIDE_SAHIHAYN_NOTE = 'ليس من الصحيحين';
export function stripArabicMarks(text) {
    return text.replace(/[\u064B-\u065F\u0670]/g, '');
}
const SAHIHAYN_CITATION = new RegExp([
    'متفق عليه',
    'رواه البخاري',
    'رواه مسلم',
    'في الصحيحين',
    'أخرجاه',
    'وفى\\s*[«"\'"]?\\s*الصحيحين',
    'وفي\\s*[«"\'"]?\\s*الصحيحين',
    'في\\s*[«"\'"]?\\s*الصحيحين',
    'خر[ّ]?جه\\s+البخاري',
    'خر[ّ]?جه\\s+مسلم',
    'خر[ّ]?جاه',
    'خرجهما',
    'أخرجه\\s+البخاري',
    'أخرجه\\s+مسلم',
    'أخرجهما',
].join('|'));
export function citesSahihayn(text) {
    return SAHIHAYN_CITATION.test(stripArabicMarks(text));
}
export function foldGradeLabel(raw) {
    return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}
export function appropriateGrade(raw) {
    return APPROPRIATE[foldGradeLabel(raw)] ?? null;
}
export function decideSunanRuling(hits) {
    const accepted = hits.flatMap((hit) => {
        const grade = appropriateGrade(hit.rawGrade);
        return grade ? [{ hit, grade }] : [];
    });
    if (accepted.length === 0)
        return null;
    const grade = accepted.some((row) => row.grade === HadithGrade.SAHIH)
        ? HadithGrade.SAHIH
        : HadithGrade.HASAN;
    const chosen = accepted.filter((row) => row.grade === grade).map((row) => row.hit);
    const scholars = SCHOLAR_ORDER
        .filter((key) => chosen.some((hit) => hit.scholar === key))
        .map((key) => SUNAN_SCHOLAR_NAMES[key]);
    const references = BOOK_ORDER.flatMap((book) => {
        const numbers = [...new Set(chosen.filter((hit) => hit.book === book).map((hit) => hit.number))].sort((a, b) => a - b);
        return numbers.map((number) => `${SUNAN_BOOK_TITLES[book]}، رقم ${number}`);
    });
    const rawGrades = [...new Set(chosen.map((hit) => hit.rawGrade))].sort();
    return {
        grade,
        gradeAuthority: scholars.join('، و'),
        gradeReference: references.join('، '),
        scholars,
        references,
        rawGrades,
    };
}
//# sourceMappingURL=sunan-tahqiq.js.map