import { HadithGrade } from '@prisma/client';
function stripDiacritics(s) {
    return s
        .replace(/[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .trim()
        .toLowerCase();
}
const GRADE_WEIGHT = {
    [HadithGrade.SAHIH]: 1,
    [HadithGrade.HASAN]: 2,
    [HadithGrade.UNGRADED]: 3,
    [HadithGrade.DAIF]: 4,
    [HadithGrade.MAWDU]: 5,
};
const GRADE_TABLE = [
    ['sahih li ghairih', HadithGrade.SAHIH],
    ['sahih lighayrih', HadithGrade.SAHIH],
    ['muttafaqun alayh', HadithGrade.SAHIH],
    ['متفق عليه', HadithGrade.SAHIH],
    ['صحيح لغيره', HadithGrade.SAHIH],
    ['authentic', HadithGrade.SAHIH],
    ['sahih', HadithGrade.SAHIH],
    ['صحيح', HadithGrade.SAHIH],
    ['hasan sahih', HadithGrade.HASAN],
    ['حسن صحيح', HadithGrade.HASAN],
    ['hasan li ghairih', HadithGrade.HASAN],
    ['حسن لغيره', HadithGrade.HASAN],
    ['good', HadithGrade.HASAN],
    ['hasan', HadithGrade.HASAN],
    ['حسن', HadithGrade.HASAN],
    ["da'if", HadithGrade.DAIF],
    ['daif', HadithGrade.DAIF],
    ['dhaeef', HadithGrade.DAIF],
    ['ضعيف', HadithGrade.DAIF],
    ['munkar', HadithGrade.DAIF],
    ['منكر', HadithGrade.DAIF],
    ['shadh', HadithGrade.DAIF],
    ['شاذ', HadithGrade.DAIF],
    ['weak', HadithGrade.DAIF],
    ['mawdu', HadithGrade.MAWDU],
    ['موضوع', HadithGrade.MAWDU],
    ['fabricated', HadithGrade.MAWDU],
    ['batil', HadithGrade.MAWDU],
    ['باطل', HadithGrade.MAWDU],
    ['la asla lahu', HadithGrade.MAWDU],
    ['لا اصل له', HadithGrade.MAWDU],
].sort((a, b) => stripDiacritics(b[0]).length - stripDiacritics(a[0]).length);
export function normalizeGrade(raw) {
    if (!raw || raw.trim() === '') {
        return { grade: HadithGrade.UNGRADED, unmapped: false };
    }
    const normalised = stripDiacritics(raw);
    for (const [needle, grade] of GRADE_TABLE) {
        if (normalised.includes(stripDiacritics(needle))) {
            return { grade, unmapped: false };
        }
    }
    return { grade: HadithGrade.UNGRADED, unmapped: true };
}
export function resolveWeakestGrade(raws) {
    let weakestWeight = -1;
    let weakest = HadithGrade.UNGRADED;
    const unmappedStrings = [];
    for (const raw of raws) {
        const { grade, unmapped } = normalizeGrade(raw);
        if (unmapped && raw)
            unmappedStrings.push(raw);
        const weight = GRADE_WEIGHT[grade];
        if (weight > weakestWeight) {
            weakestWeight = weight;
            weakest = grade;
        }
    }
    return { grade: weakest, unmappedStrings };
}
//# sourceMappingURL=grade.mapper.js.map