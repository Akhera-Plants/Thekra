import { HadithGrade } from '@prisma/client';
const SAHIH = new Set([
    'صحيح',
    'صحيح لغيره',
    'صحيح بطرقه وشواهده',
    'صحيح بشواهده',
    'صحيح بطرقه',
]);
const HASAN = new Set(['حسن', 'حسن لغيره', 'حسن بشواهده', 'حسن بطرقه وشواهده']);
const CONDITION = /\s+على\s+شرط(?:\s+(?:الشيخين|البخاري|مسلم)|هما)?$/;
const REFUSE = /ضعيف|موقوف|مقطوع|مرسل|منكر|شاذ|موضوع|باطل|لا\s+يصح|إن\s+كان|لولا|دون\s+قوله|مرفوعه|معلول|منقطع|قلب/;
const ON_CONDITION = /^(?:إسناده|إسناداه|إسناد)\s+(صحيح|صحيحان|حسن)\s+على\s+شرط\s*(?:الشيخين|البخاري|مسلم|الصحيح|الصحيحين|هما)(?:\s|$)/;
const HADITH_THEN_ISNAD = /^حديث\s+(صحيح|حسن)\s+إسناده\s+(?:صحيح|حسن|قوي)$/;
export function firstClause(raw) {
    const text = raw
        .replace(/PageV\d+P\d+|ms\d+/g, ' ')
        .replace(/[ً-ٰٟـ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text.split(/[،,.؛:#(«"]|\s+وهذا\s|\s+وهو\s|\s+ورجاله\s|\s+رجاله\s/)[0].trim();
}
export function arnautArabicGrade(raw) {
    const clause = firstClause(raw);
    if (!clause || REFUSE.test(clause))
        return null;
    const label = clause
        .replace(CONDITION, '')
        .replace(/^حديث\s+/, '')
        .replace(/^(?:إسناده|إسناداه|إسناد)\s+/, '')
        .replace(/^صحيحان$/, 'صحيح')
        .replace(/\s+من\s+أجل\s+.+$/, '')
        .trim();
    if (SAHIH.has(label))
        return HadithGrade.SAHIH;
    if (HASAN.has(label))
        return HadithGrade.HASAN;
    const opening = ON_CONDITION.exec(clause) ?? HADITH_THEN_ISNAD.exec(clause);
    if (opening)
        return opening[1] === 'حسن' ? HadithGrade.HASAN : HadithGrade.SAHIH;
    return null;
}
//# sourceMappingURL=arnaut-grade.js.map