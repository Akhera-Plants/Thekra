/**
 * «التزام شخصي»: the good deeds a user may choose, per habit, for when that habit is missed two days in a row — deeds
 * the revelation ties to forgiveness or to wiping out sins (owner round 4: at least ten, each a little demanding,
 * «برّ الوالدين» first). Each carries its evidence, shown behind a small «الدليل» button on the clients.
 *
 * Content rules (docs/guide/PROJECT_GUIDE.md §3): nothing here is a quoted text. `evidence` are Quote ids that are
 * public on the site (checked 2026-11-03 against production: published grade source, not athar, not hidden, no open
 * high flag); the text, its source and any English are read from the API, as for a habit's «المُعينات».
 * Counts in the titles use Western digits.
 *
 * The titles live here (not in each client's messages) so the web and the app name every deed the same way. Keys never
 * change: they are stored in the user's pledges (heart.ts `PledgeAction`).
 */
import type { PledgeDeed } from './heart.js';

export interface PledgeDeedInfo {
  key: PledgeDeed;
  /** The pledge's own words: «إن فاتتني يومين متتاليين: <titleAr>». */
  titleAr: string;
  titleEn: string;
  /** Public Quote ids (read through the API). */
  evidence: readonly string[];
}

/** In the order the clients list them. */
export const PLEDGE_DEED_INFO: readonly PledgeDeedInfo[] = [
  {
    key: 'birr',
    titleAr: 'أبرّ والديّ بعمل أخصّهما به',
    titleEn: 'Do a special act of kindness for my parents',
    // Bukhari 527: «الصلاة على وقتها… ثم بر الوالدين».
    evidence: ['5671bf91-6335-49b4-9011-61c74dd1c460'],
  },
  {
    key: 'istighfar',
    titleAr: 'أستغفر الله 2000 مرة',
    titleEn: 'Seek Allah’s forgiveness 2000 times',
    // Muslim 2749: «…ولجاء بقوم يذنبون فيستغفرون الله فيغفر لهم».
    evidence: ['d96ef685-dc25-4fc1-a589-12af672251d2'],
  },
  {
    key: 'salawat',
    titleAr: 'أصلّي على النبي ﷺ 2000 مرة',
    titleEn: 'Send blessings on the Prophet ﷺ 2000 times',
    // Muslim 408.
    evidence: ['d1ccc6f6-b99d-4f80-bd26-3849eccd2a32'],
  },
  {
    key: 'tasbih',
    titleAr: 'أقول «سبحان الله وبحمده» 1000 مرة',
    titleEn: 'Say “Subḥān Allāh wa biḥamdih” 1000 times',
    // Muslim 2691: «…حُطّت خطاياه وإن كانت مثل زبد البحر».
    evidence: ['042f9507-59ea-4b05-9c14-309540730321'],
  },
  {
    key: 'tahlil',
    titleAr: 'أقول «لا إله إلا الله وحده لا شريك له…» 300 مرة',
    titleEn: 'Say “Lā ilāha illā Allāh waḥdahu lā sharīka lah…” 300 times',
    // Bukhari 3293: «…ومُحيت عنه مائة سيئة».
    evidence: ['8c475f35-2175-400d-8967-5699b1ff4e18'],
  },
  {
    key: 'sawm',
    titleAr: 'أصوم يومًا',
    titleEn: 'Fast one day',
    // Bukhari 525: «…تكفّرها الصلاة والصوم والصدقة…».
    evidence: ['7d4e75a6-26d7-48fb-ba09-bf5dece80ec6'],
  },
  {
    key: 'qiyam',
    titleAr: 'أقوم الليل بإحدى عشرة ركعة',
    titleEn: 'Pray eleven rakʿahs at night',
    // Bukhari 6321: «…من يستغفرني فأغفر له».
    evidence: ['769f1041-f411-4403-90f3-bf6de1b00ca5'],
  },
  {
    key: 'rakatain',
    titleAr: 'أتوضأ وأصلي ركعتين',
    titleEn: 'Make wuḍūʾ and pray two rakʿahs',
    // Bukhari 159: «…ثم صلى ركعتين لا يحدّث فيهما نفسه غُفر له ما تقدم من ذنبه».
    evidence: ['e3645a92-6da5-4578-ab6e-e54239453208'],
  },
  {
    key: 'masjid',
    titleAr: 'أمشي إلى المسجد في الصلوات الخمس يومًا كاملًا',
    titleEn: 'Walk to the mosque for all five prayers of a day',
    // Riyad al-Salihin 1059 (Muslim): «ألا أدلكم على ما يمحو الله به الخطايا…».
    evidence: ['2637df7a-78da-4033-9a07-715b0a330829'],
  },
  {
    key: 'adhkar',
    titleAr: 'أحافظ على أذكار دبر الصلوات الخمس يومًا كاملًا',
    titleEn: 'Say the remembrance after all five prayers of a day',
    // Muslim 597.
    evidence: ['7427f5df-7e4f-4978-92dd-17cb219a2b12'],
  },
  {
    key: 'quran',
    titleAr: 'أقرأ جزءًا كاملًا من القرآن',
    titleEn: 'Read one full juzʾ of the Qur’an',
    // Hud 11:114 (the verse, from the database).
    evidence: ['5518a387-d429-4a90-be10-c0609f66d7c9'],
  },
  {
    key: 'saqy',
    titleAr: 'أسقي ماءً أو أطعم محتاجًا',
    titleEn: 'Give water or food to someone in need',
    // Bukhari 6009: «…فشكر الله له فغفر له».
    evidence: ['2032fbab-fe6a-425a-9f17-d584e940099b'],
  },
];

/** The sadaqah pledge's evidence (its amount is the user's own): Riyad al-Salihin 1522, «والصدقة تطفئ الخطيئة…». */
export const SADAQAH_EVIDENCE: readonly string[] = ['aad9de0d-ed0f-4d10-b590-24e113985917'];

export function pledgeDeedInfo(key: string): PledgeDeedInfo | undefined {
  return PLEDGE_DEED_INFO.find((d) => d.key === key);
}

/** The evidence ids of any pledge action (none for a custom line). */
export function pledgeEvidence(action: string): readonly string[] {
  if (action === 'sadaqah') return SADAQAH_EVIDENCE;
  return pledgeDeedInfo(action)?.evidence ?? [];
}
