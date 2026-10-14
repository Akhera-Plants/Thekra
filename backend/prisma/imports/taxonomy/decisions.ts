export type ItemConfidence = 'high' | 'low';

export interface ItemDecision {
  slugs: readonly string[];
  reason: string;
  confidence: ItemConfidence;
}

/**
 * Read from the fifteen ITEM sections. High rows are linked. Low rows are
 * written to the report and left unlinked. Slugs are only ones the YAML already has.
 */
export const ITEM_DECISIONS: Readonly<Record<string, ItemDecision>> = {
  // الترهيب من | — اللعن
  'f8673644-4a90-4cf9-b947-c358716d6313': { slugs: ['sabb-lan'], reason: 'لعن الرجل والديه', confidence: 'high' },
  'aee7271f-f4f4-4aab-a7c1-d70d386c831b': { slugs: ['sabb-lan'], reason: 'لا ينبغي لصدّيق أن يكون لعّانًا', confidence: 'high' },
  'abcaffcc-21c4-4934-913d-c8cc7f6bde74': { slugs: ['sabb-lan'], reason: 'النبي ينكر على أبي بكر لعنه بعض رقيقه', confidence: 'high' },
  '6a98857a-8854-4718-b480-860c0de684e2': { slugs: ['sabb-lan'], reason: 'لا يكون اللعانون شفعاء', confidence: 'high' },
  '2e2956da-8cf4-4ee7-9eff-d14a71590d4b': { slugs: ['sabb-lan'], reason: 'أوصيك ألا تكون لعّانًا', confidence: 'high' },
  'c2e796ae-26ea-4210-bea4-589c6bb763de': { slugs: ['sabb-lan'], reason: 'لا تلاعنوا بلعنة الله', confidence: 'high' },
  '58d8d7a6-3a14-4d2e-b11b-e76a833ad5e6': {
    slugs: ['yamin-ghamus', 'intihar', 'sabb-lan'],
    reason: 'يمين بملة غير الإسلام، وقتل النفس، ولعن المؤمن كقتله',
    confidence: 'high',
  },
  '10b5752d-2597-44a7-a102-277eca540513': { slugs: ['bukhl'], reason: 'آية الذين يبخلون بما آتاهم الله', confidence: 'high' },
  '8f59d3ff-5745-4e74-a091-e67372a9acd3': { slugs: ['sabb-lan'], reason: 'لعن الأخ باب من الكبائر', confidence: 'high' },
  '9c808fd0-a3d6-4d05-98bb-85957875bcda': { slugs: ['sabb-lan'], reason: 'اللعنة إذا وُجهت', confidence: 'high' },
  'dea63988-c1b7-4b3a-a363-6555758d0287': { slugs: ['sabb-lan'], reason: 'لعن الناقة في السفر', confidence: 'high' },

  // الترهيب من أ — الهجر والحسد
  '2510a924-e8f7-4bee-8bdc-8e991588976b': { slugs: ['hijran'], reason: 'لا يحل الهجر فوق ثلاثة أيام', confidence: 'high' },
  'f8d662c5-e827-405d-b47a-44d1e4fbe273': { slugs: ['hijran'], reason: 'من هجر أخاه فوق ثلاث فهو في النار', confidence: 'high' },
  '74b167fd-8342-4262-b859-d6815e4ea735': { slugs: ['hijran'], reason: 'من هجر أخاه سنة فهو كسفك دمه', confidence: 'high' },
  '82764293-efa4-426d-a460-986ba7b66a9b': { slugs: ['hijran'], reason: 'الشيطان يحرّش بين المصلين', confidence: 'high' },
  '1fa65668-51c0-4075-a603-d8459448c6bb': { slugs: ['hasad'], reason: 'لا يزال الناس بخير ما لم يتحاسدوا', confidence: 'high' },
  '9b0ccf55-5127-4d53-bdff-84949fa64f11': { slugs: ['hasad'], reason: 'دب إليكم الحسد والبغضاء', confidence: 'high' },
  '31d2328b-828f-467c-8f44-3267081b6cf1': {
    slugs: ['salamat-sadr', 'sidq'],
    reason: 'أفضل الناس مخموم القلب صدوق اللسان، لا غل فيه ولا حسد',
    confidence: 'high',
  },

  // الترهيب من تولي السلطنة
  '9cd264e4-328a-4779-b12d-7309435b9d47': { slugs: ['zulm-raiyya'], reason: 'الإمارة أولها ندامة', confidence: 'high' },
  '968dba8b-ae63-432a-8a99-da515fd9da89': { slugs: ['dhikr-akhira'], reason: 'آية افتداء الكفار من عذاب يوم القيامة', confidence: 'high' },
  'e46f634e-e720-411e-9fdc-b6633d8faac7': { slugs: ['zulm-raiyya'], reason: 'من ولي أمر عشرة أتى مغلولًا', confidence: 'high' },
  '0721da2e-bd59-48f3-86e1-b51f4ffbf82f': { slugs: ['zulm-raiyya'], reason: 'الإمارة أمانة، وأبو ذر ضعيف عنها', confidence: 'high' },
  'f402b817-b41e-4eb1-bb8e-2340af77dafc': { slugs: ['zulm-raiyya'], reason: 'ستحرصون على الإمارة وستكون ندامة', confidence: 'high' },
  '1dbddb4b-994e-4234-83b8-8895c4091b7b': { slugs: ['zulm-raiyya'], reason: 'ويل للأمراء والعرفاء والأمناء', confidence: 'high' },
  'e51f1d86-3137-4e26-bd65-183207227257': { slugs: ['zulm-raiyya'], reason: 'لا تسأل الإمارة', confidence: 'high' },

  // الامتناع عن الدخول على الظلمة
  '4543dd68-3260-40e1-ba4b-9fa0ddea9655': { slugs: ['zulm-raiyya'], reason: 'من أتى أبواب السلطان افتتن', confidence: 'high' },
  'a65fda5c-a060-4b79-9c4b-a516a340ea3b': { slugs: ['zulm-raiyya'], reason: 'من أتى السلطان افتتن', confidence: 'high' },
  'af5f31b3-d4d8-4542-96d9-21e426ed96cb': { slugs: ['zulm-raiyya'], reason: 'إمارة السفهاء', confidence: 'high' },
  'ae07302a-a0b6-4c37-bbd8-bb49548054db': { slugs: ['zulm-raiyya'], reason: 'أمراء يكونون من بعدي', confidence: 'high' },
  '42e483fd-1fc1-4b2a-85d4-97727dc3624f': {
    slugs: ['zulm-raiyya', 'zulm', 'kadhib'],
    reason: 'أمراء يظلمون ويكذبون، ومن صدّقهم بكذبهم',
    confidence: 'high',
  },
  '66938660-214c-42d5-8549-305a700c879b': {
    slugs: ['zulm-raiyya', 'kadhib'],
    reason: 'سيكون بعدي أمراء فلا تصدّقوهم بكذبهم',
    confidence: 'high',
  },

  '76695404-e6e2-49ec-90c0-d5449405d877': {
    slugs: ['zulm-raiyya', 'zulm', 'kadhib'],
    reason: 'أمراء يغشاهم الناس يكذبون ويظلمون',
    confidence: 'high',
  },
  '18417da3-cc6e-481d-89e0-b667bab0e053': {
    slugs: ['zulm-raiyya', 'hifz-al-lisan'],
    reason: 'الدخول على الأمراء، والكلمة من رضوان الله أو سخطه',
    confidence: 'high',
  },
  '1c6343a7-8bd2-4c71-810a-43b645762b09': {
    slugs: ['adl', 'zulm'],
    reason: 'الشفاعة دون حدّ، والخصومة في باطل',
    confidence: 'high',
  },
  '5c01d301-5d5e-4b21-a9a2-b72ec695e81d': { slugs: ['firar-zahf'], reason: 'آية ومن يولهم يومئذ دبره', confidence: 'high' },
  'e2d594de-3e9c-4ad9-ab2f-ae0e6576a3b4': { slugs: ['zulm'], reason: 'من يعين قومه على غير الحق', confidence: 'high' },
  '3b711395-ab32-4644-832c-e1d5455e7a42': { slugs: ['ikhlas'], reason: 'من التمس رضا الله بسخط الناس', confidence: 'high' },

  // الحياء
  '3bba2e9c-cbeb-4d28-9316-4e968bc60ee1': { slugs: ['haya'], reason: 'خلق الإسلام الحياء', confidence: 'high' },
  'bf7465ed-abfc-4a1d-924c-05ff719b7977': { slugs: [], reason: 'إحالة «فذكره» بلا متن يُقرأ', confidence: 'low' },
  '4fa982c4-6646-448c-aa0d-35a8544e08a7': { slugs: ['haya', 'sabb-lan'], reason: 'الفحش يشين والحياء يزين', confidence: 'high' },
  '1a1e0985-cd42-4aee-93b5-354581bcf4bd': { slugs: ['haya'], reason: 'الحياء والإيمان قرناء', confidence: 'high' },
  '088f3f5e-9fe9-48c5-b008-d9fe5dc2300a': { slugs: ['haya'], reason: 'استحيوا من الله حق الحياء', confidence: 'high' },

  // كراهية الموت
  '11181996-d8e2-44a2-a57f-682de816f6c0': { slugs: ['dhikr-akhira'], reason: 'من كره لقاء الله', confidence: 'high' },
  'e587e300-52dd-435a-adac-39a37f120030': { slugs: ['dhikr-akhira'], reason: 'إذا كره عبدي لقائي', confidence: 'high' },
  '762a0d19-9f11-4e82-bee1-c435e364a639': { slugs: ['dhikr-akhira'], reason: 'من كره لقاء الله كره الله لقاءه', confidence: 'high' },
  '75a1b62c-ed87-4967-85d2-6e0265abdc9e': { slugs: ['dhikr-akhira'], reason: 'حبّب إليه لقاءك', confidence: 'high' },
  '1821b9c9-3b1c-4208-9309-720713d13a12': { slugs: ['sabr'], reason: 'آية الذين إذا أصابتهم مصيبة قالوا إنا لله', confidence: 'high' },

  // غمر اليد
  'bb1afb75-d588-4f82-9dce-a8b5e36bfe8d': { slugs: ['adab-taam'], reason: 'من نام وفي يده غمر ولم يغسله', confidence: 'high' },
  '4b92ad62-3817-4dad-b80e-ee93c47dc76e': { slugs: ['adab-taam'], reason: 'غسل اليد من ريح الطعام، من حديث فاطمة', confidence: 'high' },
  '34900d0e-c868-4663-9373-ce5d8607faa6': { slugs: ['adab-taam'], reason: 'من بات وفي يده ريح غمر', confidence: 'high' },

  '19021e3e-633b-4dba-a050-81a0c1712ca4': { slugs: ['hubb-fillah'], reason: 'ما تحاب رجلان في الله', confidence: 'high' },
  'dd2d40ca-abc2-4815-b05c-19690b39c936': { slugs: ['hubb-fillah', 'haqq-jar'], reason: 'خير الأصحاب لصاحبه، وخير الجيران لجاره', confidence: 'high' },

  'f142bc5e-fba4-4b4d-a8dc-a921aa8421c8': {
    slugs: ['dhikr', 'tawhid'],
    reason: 'رضيت بالله ربًا وبالإسلام دينًا وبمحمد نبيًا',
    confidence: 'high',
  },
  '4ea5d5e0-35e3-4f51-86a0-66cb3c3286cc': { slugs: ['baghy-fakhr'], reason: 'أذهب عنكم فخر الجاهلية بالآباء', confidence: 'high' },
  '2b9b556f-f790-4fe8-8b38-cfc894bfe590': { slugs: ['sabr', 'dhikr'], reason: 'إذا مات الولد فحمد واسترجع بُني له بيت الحمد', confidence: 'high' },
  'ecb8d843-3db8-44a4-87e9-25e36059ec62': { slugs: ['hajj'], reason: 'آية وأذّن في الناس بالحج', confidence: 'high' },
};
