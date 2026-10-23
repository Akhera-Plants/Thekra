import { HadithGrade } from '@prisma/client';

/**
 * Shu'ayb al-Arna'ut's Arabic verdicts in Musnad Ahmad and Sahih Ibn Hibban
 * («إسناده صحيح على شرط الشيخين», «صحيح لغيره وهذا سند فيه انقطاع»).
 *
 * Only his own words «صحيح» or «حسن» about the narration publish it. Refused:
 * weak, mawquf, mursal, munkar or shadhdh verdicts; «قوي» and «جيد» (positive,
 * but not the word the site would show); «رجاله ثقات» (about the narrators,
 * not a verdict); «… دون قوله» (only part of the text); «مرفوعه …»; and any
 * condition («إن كان …»). Anything not recognised is refused.
 */

const SAHIH = new Set([
  'صحيح',
  'صحيح لغيره',
  'صحيح بطرقه وشواهده',
  'صحيح بشواهده',
  'صحيح بطرقه',
]);
const HASAN = new Set(['حسن', 'حسن لغيره', 'حسن بشواهده', 'حسن بطرقه وشواهده']);

/** On the narration's conditions («على شرط الشيخين»); dropped before the label is read. */
const CONDITION = /\s+على\s+شرط(?:\s+(?:الشيخين|البخاري|مسلم)|هما)?$/;
const REFUSE = /ضعيف|موقوف|مقطوع|مرسل|منكر|شاذ|موضوع|باطل|لا\s+يصح|إن\s+كان|لولا|دون\s+قوله|مرفوعه|معلول|منقطع|قلب/;
/**
 * «إسناده صحيح على شرط الشيخين» followed by an unpunctuated note about a narrator or a repeat
 * («… غير فلان», «… مكرر سندا ومتنا»): the verdict is the opening words.
 */
const ON_CONDITION = /^(?:إسناده|إسناداه|إسناد)\s+(صحيح|صحيحان|حسن)\s+على\s+شرط\s*(?:الشيخين|البخاري|مسلم|الصحيح|الصحيحين|هما)(?:\s|$)/;
/** «حديث صحيح إسناده حسن / قوي»: the verdict on the narration comes first. */
const HADITH_THEN_ISNAD = /^حديث\s+(صحيح|حسن)\s+إسناده\s+(?:صحيح|حسن|قوي)$/;

/** The opening statement: up to the first punctuation, «#», or «وهذا / وهو / ورجاله». */
export function firstClause(raw: string): string {
  const text = raw
    .replace(/PageV\d+P\d+|ms\d+/g, ' ')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.split(/[،,.؛:#(«"]|\s+وهذا\s|\s+وهو\s|\s+ورجاله\s|\s+رجاله\s/)[0]!.trim();
}

export function arnautArabicGrade(raw: string): HadithGrade | null {
  const clause = firstClause(raw);
  if (!clause || REFUSE.test(clause)) return null;
  const label = clause
    .replace(CONDITION, '')
    .replace(/^حديث\s+/, '')
    .replace(/^(?:إسناده|إسناداه|إسناد)\s+/, '')
    .replace(/^صحيحان$/, 'صحيح')
    .replace(/\s+من\s+أجل\s+.+$/, '')
    .trim();
  if (SAHIH.has(label)) return HadithGrade.SAHIH;
  if (HASAN.has(label)) return HadithGrade.HASAN;
  const opening = ON_CONDITION.exec(clause) ?? HADITH_THEN_ISNAD.exec(clause);
  if (opening) return opening[1] === 'حسن' ? HadithGrade.HASAN : HadithGrade.SAHIH;
  return null;
}
