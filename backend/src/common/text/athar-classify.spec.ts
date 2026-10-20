import { describe, expect, it } from 'vitest';
import { loadAtharSpeakers } from '../../../prisma/imports/athar/speakers.js';
import { classifyNarration, matchAtharSpeaker } from './athar-classify.js';

/** Thirty real-shaped samples printed in SHUAB_ATHAR_REPORT.md. */
const SAMPLES: Array<{
  id: number;
  kind: 'MARFU' | 'ATHAR';
  speakerKey?: string;
  text: string;
}> = [
  {
    id: 1,
    kind: 'MARFU',
    text: 'عن أبي هريرة رضي الله عنه قال: قال رسول الله صلى الله عليه وسلم: الإيمان بضع وستون شعبة',
  },
  {
    id: 2,
    kind: 'MARFU',
    text: 'عن عمر بن الخطاب قال سمعت رسول الله صلى الله عليه وسلم يقول إنما الأعمال بالنيات',
  },
  {
    id: 3,
    kind: 'MARFU',
    text: 'أن النبي صلى الله عليه وسلم قال: لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه',
  },
  {
    id: 4,
    kind: 'MARFU',
    text: 'سمعت النبي صلى الله عليه وسلم يقول: من حسن إسلام المرء تركه ما لا يعنيه',
  },
  {
    id: 5,
    kind: 'MARFU',
    text: 'عن أنس أن رسول الله صلى الله عليه وسلم قال: لا تباغضوا ولا تحاسدوا',
  },
  {
    id: 6,
    kind: 'MARFU',
    text: 'قال رسول الله صلى الله عليه وسلم: الحياء شعبة من الإيمان',
  },
  {
    id: 7,
    kind: 'MARFU',
    text: 'عن النبي صلى الله عليه وسلم: الطهور شطر الإيمان',
  },
  {
    id: 8,
    kind: 'MARFU',
    text: 'أن رجلا سأل النبي صلى الله عليه وسلم أي الإسلام خير قال تطعم الطعام',
  },
  {
    id: 9,
    kind: 'MARFU',
    text: 'قالوا يا رسول الله أي الإسلام أفضل قال من سلم المسلمون من لسانه ويده',
  },
  {
    id: 10,
    kind: 'MARFU',
    text: 'عن أبي هريرة عن صلى الله عليه وسلم قال: الإيمان بضع وستون',
  },
  {
    id: 11,
    kind: 'ATHAR',
    speakerKey: 'ibn-masud',
    text: 'عن عبد الله بن مسعود رضي الله عنه قال: اليقين الإيمان كله',
  },
  {
    id: 12,
    kind: 'ATHAR',
    speakerKey: 'umar',
    text: 'قال عمر بن الخطاب رضي الله عنه: حاسبوا أنفسكم قبل أن تحاسبوا',
  },
  {
    id: 13,
    kind: 'ATHAR',
    speakerKey: 'ali',
    text: 'عن علي بن أبي طالب قال: قيمة كل امرئ ما يحسنه',
  },
  {
    id: 14,
    kind: 'ATHAR',
    speakerKey: 'hasan-basri',
    text: 'عن الحسن قال: ما أطال عبد الأمل إلا أساء العمل',
  },
  {
    id: 15,
    kind: 'ATHAR',
    speakerKey: 'ibn-abbas',
    text: 'قال ابن عباس: الصبر في القرآن على ثلاثة أوجه',
  },
  {
    id: 16,
    kind: 'ATHAR',
    speakerKey: 'abu-bakr',
    text: 'عن أبي بكر الصديق رضي الله عنه قال: أي أرض تقلني وأي سماء تظلني',
  },
  {
    id: 17,
    kind: 'ATHAR',
    speakerKey: 'abu-darda',
    text: 'قال أبو الدرداء: لأن أعافى فأشكر أحب إلي من أن أبتلى فأصبر',
  },
  {
    id: 18,
    kind: 'ATHAR',
    speakerKey: 'mujahid',
    text: 'عن مجاهد قال: أفضل العبادة الرأي الحسن',
  },
  {
    id: 19,
    kind: 'ATHAR',
    speakerKey: 'said-musayyib',
    text: 'قال سعيد بن المسيب: لا خير فيمن لا يجمع ماله من حله',
  },
  {
    id: 20,
    kind: 'ATHAR',
    speakerKey: 'uthman',
    text: 'عن عثمان بن عفان رضي الله عنه قال: لو طهرت قلوبنا ما شبعت من كلام ربنا',
  },
  {
    id: 21,
    kind: 'ATHAR',
    speakerKey: 'ibn-umar',
    text: 'قال عبد الله بن عمر: ما آسى على شيء من الدنيا إلا على ظمأ الهواجر',
  },
  {
    id: 22,
    kind: 'ATHAR',
    speakerKey: 'salman',
    text: 'عن سلمان الفارسي قال: مثل المؤمن والكافر مثل الأعمى والبصير',
  },
  {
    id: 23,
    kind: 'ATHAR',
    speakerKey: 'qatada',
    text: 'قال قتادة: ما رأيت باكيا يضحك إلا مجنونا',
  },
  {
    id: 24,
    kind: 'ATHAR',
    speakerKey: 'umar-abd-aziz',
    text: 'عن عمر بن عبد العزيز قال: اتقوا الله في عباده وبلاده',
  },
  {
    id: 25,
    kind: 'ATHAR',
    speakerKey: 'abu-hurayra',
    text: 'قال أبو هريرة: أوصاني خليلي بثلاث لا أدعهن',
  },
  {
    id: 26,
    kind: 'ATHAR',
    speakerKey: 'aisha',
    text: 'عن عائشة رضي الله عنها قالت: كان أحب العمل إلى رسول الله أدومه',
  },
  // Sample 26 is tricky — contains رسول الله but the speaker is Aisha about him.
  // Classifier treats «رسول الله» in the saying as MARFU when paired with عن النبي patterns;
  // this wording is ATHAR of Aisha reporting preference — if it flips to MARFU, document it.
  {
    id: 27,
    kind: 'ATHAR',
    speakerKey: 'hudhayfa',
    text: 'قال حذيفة: كان الناس يسألون رسول الله عن الخير وكنت أسأله عن الشر',
  },
  {
    id: 28,
    kind: 'ATHAR',
    speakerKey: 'ibn-sirin',
    text: 'عن محمد بن سيرين قال: العلم دين فانظروا عمن تأخذون دينكم',
  },
  {
    id: 29,
    kind: 'ATHAR',
    speakerKey: 'shabi',
    text: 'قال الشعبي: ما رأيت أفقه من عائشة',
  },
  {
    id: 30,
    kind: 'ATHAR',
    text: 'قال بعض الحكماء: الصمت زين للعالم وستر للجاهل',
  },
];

describe('classifyNarration (30 samples)', () => {
  const speakers = loadAtharSpeakers();

  it.each(SAMPLES)('sample $id → $kind', (sample) => {
    const result = classifyNarration(sample.text);
    expect(result.kind).toBe(sample.kind);
    if (sample.kind === 'ATHAR' && sample.speakerKey) {
      const matched = matchAtharSpeaker(result.speakerRaw, speakers);
      expect(matched?.key).toBe(sample.speakerKey);
    }
    if (sample.kind === 'ATHAR' && !sample.speakerKey) {
      expect(matchAtharSpeaker(result.speakerRaw, speakers)).toBeNull();
    }
  });
});
