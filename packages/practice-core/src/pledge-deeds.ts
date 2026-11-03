/**
 * «التزام شخصي»: the good deeds a user may choose, per habit, for when that habit is missed two days in a row — deeds
 * the revelation says wipe out sins (owner round 4: at least ten, each a little demanding, «برّ الوالدين» among the first,
 * after Ibn ʿAbbās's word). Each carries its evidence, shown behind a small «الدليل» button on the clients.
 *
 * The titles live here (not in each client's messages) so the web and the app name every deed the same way. Keys never
 * change: they are stored in the user's pledges (heart.ts `PledgeAction`).
 */
import type { PledgeDeed } from './heart.js';

export interface PledgeEvidence {
  /** The text itself (Arabic), the part that speaks of the reward, quoted as narrated. */
  textAr: string;
  /** Its meaning in English (a translation of the meaning, not a quotation). */
  textEn: string;
  /** «رواه البخاري (6405) ومسلم (2691)». */
  sourceAr: string;
  /** "Bukhari 6405, Muslim 2691". */
  sourceEn: string;
}

export interface PledgeDeedInfo {
  key: PledgeDeed;
  /** The pledge's own words: «إن فاتتني يومين متتاليين: <titleAr>». */
  titleAr: string;
  titleEn: string;
  evidence: PledgeEvidence;
}

/** In the order the clients list them. */
export const PLEDGE_DEED_INFO: readonly PledgeDeedInfo[] = [
  {
    key: 'birr',
    titleAr: 'أبرّ والديّ بعمل أخصّهما به',
    titleEn: 'Do a special act of kindness for my parents',
    evidence: {
      textAr: 'قال ابن عباس: «إني لا أعلم عملًا أقرب إلى الله عز وجل من برّ الوالدة»',
      textEn: 'Ibn ʿAbbās said: "I know of no deed that brings one closer to Allah than kindness to one\'s mother."',
      sourceAr: 'أثر عن ابن عباس، رواه البخاري في الأدب المفرد (4)، وصححه الألباني',
      sourceEn: 'Saying of Ibn ʿAbbās, al-Adab al-Mufrad 4 (graded ṣaḥīḥ by al-Albānī)',
    },
  },
  {
    key: 'istighfar',
    titleAr: 'أستغفر الله ٢٠٠٠ مرة',
    titleEn: 'Seek Allah\'s forgiveness 2,000 times',
    evidence: {
      textAr: '«طوبى لمن وجد في صحيفته استغفارًا كثيرًا»',
      textEn: '"Glad tidings to whoever finds much seeking of forgiveness in his record."',
      sourceAr: 'رواه ابن ماجه (3818)، وصححه الألباني',
      sourceEn: 'Ibn Mājah 3818 (graded ṣaḥīḥ by al-Albānī)',
    },
  },
  {
    key: 'salawat',
    titleAr: 'أصلّي على النبي ﷺ ٢٠٠٠ مرة',
    titleEn: 'Send blessings on the Prophet ﷺ 2,000 times',
    evidence: {
      textAr: '«من صلّى عليّ صلاة واحدة صلّى الله عليه عشر صلوات، وحُطّت عنه عشر خطيئات، ورُفعت له عشر درجات»',
      textEn: '"Whoever sends one blessing on me, Allah sends ten on him, ten sins are removed from him and he is raised ten degrees."',
      sourceAr: 'رواه النسائي (1297)، وصححه الألباني',
      sourceEn: 'al-Nasāʾī 1297 (graded ṣaḥīḥ by al-Albānī)',
    },
  },
  {
    key: 'tasbih',
    titleAr: 'أقول «سبحان الله وبحمده» ١٠٠٠ مرة',
    titleEn: 'Say "Subḥān Allāh wa biḥamdih" 1,000 times',
    evidence: {
      textAr: '«من قال: سبحان الله وبحمده، في يوم مائة مرة، حُطّت خطاياه وإن كانت مثل زبد البحر»',
      textEn: '"Whoever says Subḥān Allāh wa biḥamdih a hundred times a day, his sins are removed even if they are like the foam of the sea."',
      sourceAr: 'متفق عليه: رواه البخاري (6405) ومسلم (2691)',
      sourceEn: 'Bukhari 6405, Muslim 2691',
    },
  },
  {
    key: 'tahlil',
    titleAr: 'أقول «لا إله إلا الله وحده لا شريك له…» ٣٠٠ مرة',
    titleEn: 'Say "Lā ilāha illā Allāh waḥdahu lā sharīka lah…" 300 times',
    evidence: {
      textAr: '«…كانت له عدل عشر رقاب، وكُتبت له مائة حسنة، ومُحيت عنه مائة سيئة، وكانت له حرزًا من الشيطان يومه ذلك حتى يمسي»',
      textEn: '"…it is for him like freeing ten slaves, a hundred good deeds are written for him, a hundred bad deeds are erased, and it guards him from Satan that day until evening."',
      sourceAr: 'متفق عليه: رواه البخاري (3293) ومسلم (2691)',
      sourceEn: 'Bukhari 3293, Muslim 2691',
    },
  },
  {
    key: 'sawm',
    titleAr: 'أصوم يومًا',
    titleEn: 'Fast one day',
    evidence: {
      textAr: '«فتنة الرجل في أهله وماله وولده وجاره، تكفّرها الصلاة والصوم والصدقة والأمر والنهي»',
      textEn: '"A man\'s trials in his family, wealth, children and neighbour are expiated by prayer, fasting, charity, and enjoining good and forbidding evil."',
      sourceAr: 'متفق عليه: رواه البخاري (525) ومسلم (144)، واللفظ للبخاري',
      sourceEn: 'Bukhari 525, Muslim 144 (Bukhari\'s wording)',
    },
  },
  {
    key: 'qiyam',
    titleAr: 'أقوم الليل بإحدى عشرة ركعة',
    titleEn: 'Pray eleven rakʿahs at night',
    evidence: {
      textAr: '«عليكم بقيام الليل، فإنه دأب الصالحين قبلكم، وهو قربة إلى ربكم، ومكفرة للسيئات، ومنهاة للإثم»',
      textEn: '"Hold to the night prayer: it was the way of the righteous before you, it brings you near to your Lord, expiates bad deeds and keeps from sin."',
      sourceAr: 'رواه الترمذي (3549) من حديث أبي أمامة، وحسّنه الألباني',
      sourceEn: 'al-Tirmidhī 3549, from Abū Umāmah (graded ḥasan by al-Albānī)',
    },
  },
  {
    key: 'rakatain',
    titleAr: 'أتوضأ وأصلي ركعتين وأستغفر',
    titleEn: 'Make wuḍūʾ, pray two rakʿahs and seek forgiveness',
    evidence: {
      textAr: '«ما من عبد يذنب ذنبًا فيُحسن الطهور، ثم يقوم فيصلي ركعتين، ثم يستغفر الله، إلا غفر الله له»',
      textEn: '"No servant commits a sin, then purifies himself well, rises and prays two rakʿahs, then asks Allah\'s forgiveness, but Allah forgives him."',
      sourceAr: 'رواه أبو داود (1521)، وصححه الألباني',
      sourceEn: 'Abū Dāwūd 1521 (graded ṣaḥīḥ by al-Albānī)',
    },
  },
  {
    key: 'masjid',
    titleAr: 'أمشي إلى المسجد في الصلوات الخمس يومًا كاملًا',
    titleEn: 'Walk to the mosque for all five prayers of a day',
    evidence: {
      textAr: '«ألا أدلكم على ما يمحو الله به الخطايا ويرفع به الدرجات؟… إسباغ الوضوء على المكاره، وكثرة الخطا إلى المساجد، وانتظار الصلاة بعد الصلاة»',
      textEn: '"Shall I not tell you what Allah wipes out sins and raises degrees with? … Perfect wuḍūʾ in hardship, many steps to the mosques, and waiting for the next prayer after a prayer."',
      sourceAr: 'رواه مسلم (251)',
      sourceEn: 'Muslim 251',
    },
  },
  {
    key: 'adhkar',
    titleAr: 'أحافظ على أذكار دبر الصلوات الخمس يومًا كاملًا',
    titleEn: 'Say the remembrance after all five prayers of a day',
    evidence: {
      textAr: '«من سبّح الله في دبر كل صلاة ثلاثًا وثلاثين… وقال تمام المائة: لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير، غُفرت خطاياه وإن كانت مثل زبد البحر»',
      textEn: '"Whoever glorifies Allah after every prayer thirty-three times… and completes the hundred with: none is worshipped but Allah alone, without partner, His is the dominion and His the praise and He is able to do all things — his sins are forgiven even if they are like the foam of the sea."',
      sourceAr: 'رواه مسلم (597)',
      sourceEn: 'Muslim 597',
    },
  },
  {
    key: 'quran',
    titleAr: 'أقرأ جزءًا كاملًا من القرآن',
    titleEn: 'Read one full juzʾ of the Qur\'an',
    evidence: {
      textAr: '﴿إِنَّ الْحَسَنَاتِ يُذْهِبْنَ السَّيِّئَاتِ﴾',
      textEn: '"Indeed, good deeds do away with bad deeds."',
      sourceAr: '[هود: 114]',
      sourceEn: 'Qur\'an 11:114',
    },
  },
  {
    key: 'saqy',
    titleAr: 'أسقي ماءً أو أطعم محتاجًا',
    titleEn: 'Give water or food to someone in need',
    evidence: {
      textAr: '«…فملأ خفّه ماءً فسقى الكلب، فشكر الله له فغفر له»',
      textEn: '"…he filled his shoe with water and gave the dog to drink; Allah thanked him for it and forgave him."',
      sourceAr: 'متفق عليه: رواه البخاري (2363) ومسلم (2244)',
      sourceEn: 'Bukhari 2363, Muslim 2244',
    },
  },
  {
    key: 'istighfarKabir',
    titleAr: 'أقول «أستغفر الله الذي لا إله إلا هو الحي القيوم وأتوب إليه» ١٠٠ مرة',
    titleEn: 'Say "Astaghfiru Allāh alladhī lā ilāha illā huwa al-Ḥayy al-Qayyūm wa atūbu ilayh" 100 times',
    evidence: {
      textAr: '«من قال: أستغفر الله الذي لا إله إلا هو الحي القيوم وأتوب إليه، غُفر له وإن كان فرّ من الزحف»',
      textEn: '"Whoever says: I seek the forgiveness of Allah, besides whom none is worshipped, the Ever-Living, the Sustainer, and I turn to Him in repentance — he is forgiven, even if he fled from battle."',
      sourceAr: 'رواه أبو داود (1517) والترمذي (3577)، واللفظ للترمذي، وصححه الألباني',
      sourceEn: 'Abū Dāwūd 1517, al-Tirmidhī 3577 (al-Tirmidhī\'s wording; graded ṣaḥīḥ by al-Albānī)',
    },
  },
];

/** The sadaqah pledge's evidence (its amount is the user's own). */
export const SADAQAH_EVIDENCE: PledgeEvidence = {
  textAr: '«والصدقة تطفئ الخطيئة كما يطفئ الماء النار»',
  textEn: '"And charity puts out sin as water puts out fire."',
  sourceAr: 'رواه الترمذي (2616)، وصححه الألباني',
  sourceEn: 'al-Tirmidhī 2616 (graded ṣaḥīḥ by al-Albānī)',
};

export function pledgeDeedInfo(key: string): PledgeDeedInfo | undefined {
  return PLEDGE_DEED_INFO.find((d) => d.key === key);
}
