import { describe, expect, it } from 'vitest';
import { classifyNarration, foldArabic, matchAtharSpeaker, stripOcrNoise } from './athar-classify.js';
import { loadAtharSpeakers } from '../../../prisma/imports/athar/speakers.js';

/**
 * Real misclassification cases from the athar audit
 * (docs/build/CURSOR_SHUAB_ATHAR_IBNABIDUNYA follow-up).
 */
describe('athar audit — empty / chain-only (a)', () => {
  it('rejects a chain that ends at عن أبي الدرداء with no saying', () => {
    const text =
      'أخبرنا ابن المبارك، أخبرنا سفيان، عن عبدة، عن سويد بن غفلة، عن أبي الدرداء';
    const result = classifyNarration(text);
    expect(result.kind).toBe('REJECT');
  });

  it('rejects قال الحسن with nothing quoted after', () => {
    expect(classifyNarration('قال الحسن').kind).toBe('REJECT');
    expect(
      classifyNarration('أنا عبدان، قال: أنا عبد الله بن المبارك، قال: أنبا طلحة بن صبيح، عن الحسن، قال')
        .kind,
    ).toBe('REJECT');
  });
});

describe('athar audit — speaker is the quoted person (b)', () => {
  const speakers = loadAtharSpeakers();

  it('Maymun ibn Abi Shabib, not الحسن بن الحر in the chain → not hasan-basri', () => {
    const text =
      'حدثنا حسين الجعفي، عن الحسن بن الحر، عن ميمون بن أبي شبيب قال: «قعدت أكتب كتابا، فمررت بحرف إن أنا كتبته زينت الكتاب، وكنت قد كذبت، فعزمت على تركه»';
    const result = classifyNarration(text);
    expect(result.kind).toBe('ATHAR');
    expect(foldArabic(result.speakerRaw ?? '')).toContain(foldArabic('ميمون'));
    expect(matchAtharSpeaker(result.speakerRaw, speakers)?.key).not.toBe('hasan-basri');
  });

  it('Wahb ibn Munabbih, not أبو عمر in the chain → not umar', () => {
    const text =
      'أخبركم أبو عمر بن حيويه، وأبو بكر الوراق قالا: أخبرنا يحيى قال: حدثنا الحسين قال: أخبرنا ابن المبارك قال: أخبرنا معمر، عن محمد بن عمرو قال: سمعت وهب بن منبه يقول: وجدت في بعض الكتب أن الله تعالى يقول: «إن عبدي إذا أطاعني فإني أستجيب له قبل أن يدعوني»';
    const result = classifyNarration(text);
    expect(result.kind).toBe('ATHAR');
    expect(foldArabic(result.speakerRaw ?? '')).toContain(foldArabic('وهب'));
    expect(matchAtharSpeaker(result.speakerRaw, speakers)?.key).not.toBe('umar');
  });

  it("Hudhayfa's question to Salman is attributed to Hudhayfa, not Salman", () => {
    const text =
      'قال حذيفة لسلمان: ألا تبني لك مسكنا يا أبا عبد الله؟، قال: " لم تجعلني ملكا أو تجعل لي بيتا مثل دارك التي بالمدائن؟ "';
    const result = classifyNarration(text);
    expect(result.kind).toBe('ATHAR');
    expect(foldArabic(result.speakerRaw ?? '')).toContain(foldArabic('حذيفة'));
    expect(matchAtharSpeaker(result.speakerRaw, speakers)?.key).toBe('hudhayfa');
  });
});

describe('athar audit — prophetic reports are MARFU (c)', () => {
  it('Friday-ghusl of Abu Hurayra with سمعنا رسول الله is MARFU', () => {
    const text =
      'عن أبي هريرة، وأبي سعيد، قالا: سمعنا رسول الله صلى الله عليه وسلم يقول: " من اغتسل يوم الجمعة، واستن، ومس من طيب إن كان عنده ولبس أحسن ثيابه، ثم جاء إلى المسجد، ولم يتخط رقاب الناس ثم ركع ما شاء الله أن يركع، ثم أنصت إذا خرج الإمام حتى يصلي كانت كفارة لما بينها وبين الجمعة التي كانت قبلها " يقول أبو هريرة: " وزاد ثلاثة أيام إن الله قد جعل الحسنة بعشر أمثالها "';
    expect(classifyNarration(text).kind).toBe('MARFU');
  });

  it('عن ابن عمر رفعه is MARFU', () => {
    const text =
      'عن نافع، عن ابن عمر رفعه قال: " إن الرجل ليكون من أهل الصلاة، والزكاة، والجهاد، والحج، حتى ذكر سهام الخير وما يجزى يوم القيامة إلا بقدر عقله "';
    expect(classifyNarration(text).kind).toBe('MARFU');
  });

  it('يرفعه / مرفوعا / يبلغ به النبي cues are MARFU', () => {
    expect(
      classifyNarration('عن الحسن، يرفعه قال: «إن الله يبتلي العبد فيما أعطاه»').kind,
    ).toBe('MARFU');
    expect(
      classifyNarration('عن أبي الدرداء، يبلغ به قال: «ما شيء أثقل في ميزان المؤمن من خلق حسن»').kind,
    ).toBe('MARFU');
    expect(
      classifyNarration('عن حذيفة ورفعه قال: " يأتي عليكم زمان لا ينجو فيه إلا من دعا دعاء الغرقى "')
        .kind,
    ).toBe('MARFU');
  });

  it('Anas narrating مر رسول الله … فقال is MARFU (bare Prophet mention)', () => {
    const text =
      "عن أنس بن مالك قال: مر رسول الله على قبة فقال: 'يا أنس لمن هذه القبة'. قلت: لفلان. قال: 'كل بناء وبال على أهله يوم القيامة'";
    expect(classifyNarration(text).kind).toBe('MARFU');
  });

  it('أوصاني خليلي صلى الله عليه وسلم is MARFU', () => {
    const text =
      'عن أبي ذر قال: أوصاني خليلي صلى الله عليه وسلم: «إذا صنعت مرقا فأكثر ماءها»';
    expect(classifyNarration(text).kind).toBe('MARFU');
  });
});

describe('athar audit — speaker YAML matching', () => {
  const speakers = loadAtharSpeakers();

  it('does not map عمار بن سعيد to ammar (عمار بن ياسر)', () => {
    expect(matchAtharSpeaker('عمار بن سعيد', speakers)?.key).not.toBe('ammar');
  });

  it('does not map علي بن ثابت to ali', () => {
    expect(matchAtharSpeaker('علي بن ثابت', speakers)?.key).not.toBe('ali');
  });

  it('still maps عمار بن ياسر and علي بن أبي طالب', () => {
    expect(matchAtharSpeaker('عمار بن ياسر', speakers)?.key).toBe('ammar');
    expect(matchAtharSpeaker('علي بن أبي طالب', speakers)?.key).toBe('ali');
  });

  it('does not map حذيفة المرعشي to hudhayfa (حذيفة بن اليمان)', () => {
    expect(matchAtharSpeaker('حذيفة المرعشي', speakers)?.key).not.toBe('hudhayfa');
    expect(matchAtharSpeaker('حذيفة', speakers)?.key).toBe('hudhayfa');
  });

  it('does not map أبو سعيد الخراز / أبو بكر الرازي to Companions', () => {
    expect(matchAtharSpeaker('أبو سعيد الخراز', speakers)?.key).not.toBe('abu-said');
    expect(matchAtharSpeaker('أبا بكر الرازي', speakers)?.key).not.toBe('abu-bakr');
    expect(matchAtharSpeaker('أبو سعيد الخدري', speakers)?.key).toBe('abu-said');
    expect(matchAtharSpeaker('أبو بكر الصديق', speakers)?.key).toBe('abu-bakr');
  });
});

describe('athar audit — قال لـ and isnad-only saying', () => {
  const speakers = loadAtharSpeakers();

  it('أبو بكر قال لعمر is abu-bakr, not umar', () => {
    const text =
      'أخبرنا إسماعيل بن أبي خالد، عن زبيد أن أبا بكر قال لعمر بن الخطاب: «إني موصيك بوصية إن حفظتها: إن لله تعالى حقا بالنهار لا يقبله بالليل»';
    const result = classifyNarration(text);
    expect(result.kind).toBe('ATHAR');
    expect(matchAtharSpeaker(result.speakerRaw, speakers)?.key).toBe('abu-bakr');
  });

  it('rejects مجاهد قال followed only by وحدثنا isnad', () => {
    const text =
      'حدثنا فضيل، عن منصور، عن مجاهد قال: وحدثنا حماد بن زيد، عن أبي الجوزاء';
    expect(classifyNarration(text).kind).toBe('REJECT');
  });

  it('عن كعب، قال wins over a later قال ابن عمر gloss', () => {
    const text =
      'عن سالم بن عبد الله بن عمر، عن أبيه، عن كعب، قال: «قالت الملائكة وذكروا أعمال بني آدم وما يأتون من الذنوب، فاختاروا هاروت وماروت، فنزلا فلا تسرقوا ولا تزنيا» قال ابن عمر: فقال كعب: «فوالله ما أمسيا حتى أتيا ما حرم الله»';
    const result = classifyNarration(text);
    expect(result.kind).toBe('ATHAR');
    expect(foldArabic(result.speakerRaw ?? '')).toContain(foldArabic('كعب'));
  });
});

describe('athar audit — OCR noise (d)', () => {
  it('strips [ $ ] and pipes from otherwise clean text', () => {
    const cleaned = stripOcrNoise('قال الحسن : ما أطال عبد الأمل إلا أساء العمل | |');
    expect(cleaned.includes('|')).toBe(false);
    expect(classifyNarration('قال الحسن : «ما أطال عبد الأمل إلا أساء العمل»').kind).toBe('ATHAR');
  });

  it('rejects text that still contains OCR junk after stripping', () => {
    expect(classifyNarration('قال الحسن: «الكلام الطيب من الإيمان كله» [ص: 12]').kind).toBe(
      'REJECT',
    );
    expect(classifyNarration('قال عمر: «حاسبوا أنفسكم قبل أن تحاسبوا» PageV01P083').kind).toBe(
      'REJECT',
    );
  });
});

