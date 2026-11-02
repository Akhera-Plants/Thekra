import { describe, expect, it } from 'vitest';
import {
  CONTEXT_MAX_WORDS,
  contextMatn,
  displayMatn,
  joinNarration,
  matnForMatching,
  splitMatn,
  startsWithNarratorLead,
} from './matn.js';

describe('splitMatn', () => {
  it('splits Sahih al-Bukhari 1 at the last prophetic speech', () => {
    const narration =
      'حدثنا الحميدي عبد الله بن الزبير قال حدثنا سفيان قال حدثنا يحيى بن سعيد الأنصاري قال أخبرني محمد بن إبراهيم التيمي أنه سمع علقمة بن وقاص الليثي يقول سمعت عمر بن الخطاب رضي الله عنه على المنبر قال سمعت رسول الله صلى الله عليه وسلم يقول إنما الأعمال بالنيات وإنما لكل امرئ ما نوى';
    const split = splitMatn(narration);
    expect(split.matnText.startsWith('إنما الأعمال بالنيات')).toBe(true);
    expect(split.isnadText).toContain('حدثنا الحميدي');
    expect(split.isnadText.endsWith('يقول')).toBe(true);
  });

  it('splits a Muslim chain at قال after أن رسول الله', () => {
    const narration =
      'وحدثنا أبو بكر بن أبي شيبة حدثنا غندر عن شعبة عن منصور عن ربعي بن حراش أنه سمع عليا رضي الله عنه يخطب قال قال رسول الله صلى الله عليه وسلم لا تكذبوا علي فإنه من يكذب علي يلج النار';
    expect(splitMatn(narration).matnText.startsWith('لا تكذبوا علي')).toBe(true);
  });

  it('splits an al-Adab al-Mufrad narration', () => {
    const narration =
      'حدثنا علي قال: حدثنا مروان قال: حدثنا قنان بن عبد الله النهمي قال: حدثنا عبد الرحمن بن عوسجة، عن البراء بن عازب قال: قال رسول الله صلى الله عليه وسلم: «الأشرة شر»';
    expect(splitMatn(narration).matnText.startsWith('«الأشرة شر»')).toBe(true);
  });

  it('splits a Shuab al-Iman narration', () => {
    const narration =
      'أخبرنا أبو الحسن محمد بن الحسين بن داود العلوي , أنا أبو طاهر المحمد أباذي , نا العباس بن محمد الدوري , نا خالد بن مخلد , نا عبد الله بن عمر , عن سهيل بن أبي صالح , عن أبيه , عن أبي هريرة قال: قال رسول الله صلى الله عليه وسلم: " من أصيب له ولدان أو ثلاثة لم يبلغوا الحنث فاحتسبهم كانوا له سترا من النار "';
    expect(splitMatn(narration).matnText.startsWith('" من أصيب له ولدان')).toBe(true);
  });

  it('splits a Sahih al-Targhib narration and leaves the takhrij remark out of the isnad cut', () => {
    const narration =
      '١٩٦١ - (۱۱) وعن أبي هريرة رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم « إِنَّ المعونَةَ تَأْتِي مِنَ الله على قدْرِ المَوْنَةِ ، وَإِنَّ الصبرَ يَأْتِي مِنَ الله على قَدْرِ البَلاءِ » . رواه البزار';
    const split = splitMatn(narration);
    expect(split.matnText.startsWith('« إِنَّ المعونَةَ')).toBe(true);
    expect(split.matnText).toContain('رواه البزار');
  });

  it('splits a Riyad al-Salihin narration that opens with أن رسول الله', () => {
    const narration =
      '١٩٠٥ - وَعَنْ صُهَيْب له ، أَنَّ رَسُولَ اللهِ صلى الله عليه وسلم قَالَ: «إِذَا دَخَلَ أَهْلُ رضي عنه. الجَنَّةِ الجَنَّةَ؛ يَقُولُ اللَّهُ - تَبَارَكَ وَتَعَالَى -: تُرِيدُونَ شَيْئاً أَزِيدُكُمْ؟ فَيَقُولُونَ: أَلَمْ تُبَيِّض وُجُوهَنَا»';
    expect(splitMatn(narration).matnText.startsWith('«إِذَا دَخَلَ أَهْلُ')).toBe(true);
  });

  it('splits a Zuhd narration', () => {
    const narration =
      '( ۲۳۸ ) أخبرنا حماد بن سلمة عن عبيد الله بن أبي بكر عن أنس بن مالك قال : قال رسول الله صلى الله عليه وسلم : « هذا ابن آدم وهذا أجله ووضع يده عند قفاه ثم بسط يده فقال ثم أجله وثم أمله';
    expect(splitMatn(narration).matnText.startsWith('« هذا ابن آدم')).toBe(true);
  });

  it('splits a question put to the Prophet when the isnad has no قال رسول الله', () => {
    const narration =
      'حدثنا عمرو بن خالد قال حدثنا الليث عن يزيد عن أبي الخير عن عبد الله بن عمرو رضي الله عنهما أن رجلا سأل النبي صلى الله عليه وسلم أي الإسلام خير قال تطعم الطعام وتقرأ السلام على من عرفت ومن لم تعرف';
    const split = splitMatn(narration);
    expect(split.matnText.startsWith('حدثنا')).toBe(false);
    expect(split.matnText).toContain('تطعم الطعام');
    expect(split.isnadText.startsWith('حدثنا عمرو')).toBe(true);
  });

  it('splits قالوا يا رسول الله', () => {
    const narration =
      'حدثنا سعيد بن يحيى بن سعيد القرشي قال حدثنا أبي قال حدثنا أبو بردة بن عبد الله بن أبي بردة عن أبي بردة عن أبي موسى رضي الله عنه قال قالوا يا رسول الله أي الإسلام أفضل قال من سلم المسلمون من لسانه ويده';
    const split = splitMatn(narration);
    expect(split.matnText.startsWith('حدثنا')).toBe(false);
    expect(split.matnText).toContain('من سلم المسلمون');
  });

  it('drops a footnote marker from the matn', () => {
    const narration =
      'حدثنا عبد الله بن مسلمة قال قال رسول الله صلى الله عليه وسلم لا تحاسدوا ولا تناجشوا \\ 1 \\ وكونوا عباد الله إخوانا';
    const split = splitMatn(narration);
    expect(split.matnText).toContain('لا تحاسدوا ولا تناجشوا');
    expect(split.matnText).not.toContain('\\');
  });

  it('keeps the whole text when no transmission phrase is present', () => {
    const narration = 'هذا متن بلا إسناد طويل يكفي لاختبار الحالة التي لا تظهر فيها صيغة التحديث';
    expect(splitMatn(narration)).toEqual({ isnadText: '', matnText: narration });
  });
});

/**
 * Real stored narrations (Quote.rawPayload.isnadText + Quote.textAr, OpenITI) and the reviewed context text
 * from the 2026-11-01 audit (proposals.json). The stored halves are joined as the publish step joins them.
 */
interface StoredNarration {
  isnad: string;
  matn: string;
  context: string;
}

// Sahih Muslim 1403
const MUSLIM_1403: StoredNarration = {
  isnad:
    'حدثنا عمرو بن علي حدثنا عبد الأعلى حدثنا هشام بن أبي عبد الله عن أبي الزبير عن جابر أن رسول الله صلى الله عليه وسلم',
  matn:
    'رأى امرأة فأتى امرأته زينب وهي تمعس منيئة لها فقضى حاجته ثم خرج إلى أصحابه فقال ان المرأة تقبل في صورة شيطان وتدبر في صورة شيطان فإذا أبصر أحدكم امرأة فليأت أهله فإن ذلك يرد ما في نفسه',
  context:
    'عن جابر أن رسول الله صلى الله عليه وسلم رأى امرأة فأتى امرأته زينب وهي تمعس منيئة لها فقضى حاجته ثم خرج إلى أصحابه فقال ان المرأة تقبل في صورة شيطان وتدبر في صورة شيطان فإذا أبصر أحدكم امرأة فليأت أهله فإن ذلك يرد ما في نفسه',
};

// Sahih Muslim 1733
const MUSLIM_1733: StoredNarration = {
  isnad:
    'حدثنا عبيد الله بن سعيد ومحمد بن حاتم واللفظ لابن حاتم قال',
  matn:
    'ا حدثنا يحيى بن سعيد القطان حدثنا قرة بن خالد حدثنا حميد بن هلال حدثني أبو بردة قال قال أبو موسى أقبلت إلى النبي صلى الله عليه وسلم ومعي رجلان من الأشعريين أحدهما عن يميني والآخر عن يساري فكلاهما سأل العمل والنبي صلى الله عليه وسلم يستاك فقال ما تقول يا أبا موسى أو يا عبد الله بن قيس قال فقلت والذي بعثك بالحق ما أطلعاني على ما في أنفسهما وما شعرت أنهما يطلبان العمل قال وكأني أنظر إلى سواكه تحت شفته وقد قلصت فقال لن أو لا نستعمل على عملنا من أراده ولكن اذهب أنت يا أبا موسى أو يا عبد الله بن قيس فبعثه على اليمن ثم أتبعه معاذ بن جبل فلما قدم عليه قال انزل وألقى له وسادة وإذا رجل عنده موثق قال ما هذا قال هذا كان يهوديا فأسلم ثم راجع دينه دين السوء فتهود قال لا أجلس حتى يقتل قضاء الله ورسوله فقال اجلس نعم قال لا أجلس حتى يقتل قضاء الله ورسوله ثلاث مرات فأمر به فقتل ثم تذاكرا القيام من الليل فقال أحدهما معاذ أما أنا فأنام وأقوم وأرجو في نومتي ما أرجو في قومتي',
  context:
    'أبو بردة قال قال أبو موسى أقبلت إلى النبي صلى الله عليه وسلم ومعي رجلان من الأشعريين أحدهما عن يميني والآخر عن يساري فكلاهما سأل العمل والنبي صلى الله عليه وسلم يستاك فقال ما تقول يا أبا موسى أو يا عبد الله بن قيس قال فقلت والذي بعثك بالحق ما أطلعاني على ما في أنفسهما وما شعرت أنهما يطلبان العمل قال وكأني أنظر إلى سواكه تحت شفته وقد قلصت فقال لن أو لا نستعمل على عملنا من أراده ولكن اذهب أنت يا أبا موسى أو يا عبد الله بن قيس فبعثه على اليمن ثم أتبعه معاذ بن جبل فلما قدم عليه قال انزل وألقى له وسادة وإذا رجل عنده موثق قال ما هذا قال هذا كان يهوديا فأسلم ثم راجع دينه دين السوء فتهود قال لا أجلس حتى يقتل قضاء الله ورسوله فقال اجلس نعم قال لا أجلس حتى يقتل قضاء الله ورسوله ثلاث مرات فأمر به فقتل ثم تذاكرا القيام من الليل فقال أحدهما معاذ أما أنا فأنام وأقوم وأرجو في نومتي ما أرجو في قومتي',
};

// Sahih al-Bukhari 751
const BUKHARI_751: StoredNarration = {
  isnad:
    'حدثنا مسدد، قال: حدثنا أبو الأحوص، قال: حدثنا أشعث بن سليم، عن أبيه، عن مسروق، عن عائشة، قالت: سألت رسول الله صلى الله عليه وسلم',
  matn:
    'عن الالتفات في الصلاة؟ فقال: «هو اختلاس يختلسه الشيطان من صلاة العبد»',
  context:
    'عن عائشة، قالت: سألت رسول الله صلى الله عليه وسلم عن الالتفات في الصلاة؟ فقال: «هو اختلاس يختلسه الشيطان من صلاة العبد»',
};

// Sahih al-Bukhari 7154
const BUKHARI_7154: StoredNarration = {
  isnad:
    'حدثنا إسحاق بن منصور، أخبرنا عبد الصمد، حدثنا شعبة، حدثنا ثابت البناني، قال سمعت أنس بن مالك يقول لامرأة من أهله: تعرفين فلانة؟ قالت: نعم، قال: فإن النبي صلى الله عليه وسلم مر بها وهي تبكي عند قبر، فقال: «اتقي الله، واصبري»، فقالت: إليك عني، فإنك خلو من مصيبتي، قال: فجاوزها ومضى، فمر بها رجل فقال: ما قال لك رسول الله صلى الله عليه وسلم؟ قالت: ما عرفته؟ قال: إنه لرسول الله صلى الله عليه وسلم، قال: فجاءت إلى بابه فلم تجد عليه بوابا، فقالت: يا رسول الله، والله ما عرفتك، فقال النبي صلى الله عليه وسلم',
  matn:
    '«إن الصبر عند أول صدمة»',
  context:
    'ثابت البناني، قال سمعت أنس بن مالك يقول لامرأة من أهله: تعرفين فلانة؟ قالت: نعم، قال: فإن النبي صلى الله عليه وسلم مر بها وهي تبكي عند قبر، فقال: «اتقي الله، واصبري»، فقالت: إليك عني، فإنك خلو من مصيبتي، قال: فجاوزها ومضى، فمر بها رجل فقال: ما قال لك رسول الله صلى الله عليه وسلم؟ قالت: ما عرفته؟ قال: إنه لرسول الله صلى الله عليه وسلم، قال: فجاءت إلى بابه فلم تجد عليه بوابا، فقالت: يا رسول الله، والله ما عرفتك، فقال النبي صلى الله عليه وسلم «إن الصبر عند أول صدمة»',
};

// Sahih al-Bukhari 5597
const BUKHARI_5597: StoredNarration = {
  isnad:
    'حدثنا يحيى بن بكير، حدثنا يعقوب بن عبد الرحمن القاري، عن أبي حازم، قال: سمعت سهل بن سعد الساعدي: أن أبا أسيد الساعدي دعا النبي صلى الله عليه وسلم لعرسه، فكانت امرأته خادمهم يومئذ، وهي العروس، فقال',
  matn:
    'ت: «ما تدرون ما أنقعت لرسول الله صلى الله عليه وسلم؟ أنقعت له تمرات من الليل في تور» ورأى عمر، وأبو عبيدة، ومعاذ، «شرب الطلاء على الثلث» وشرب البراء، وأبو جحيفة، على النصف وقال ابن عباس: «اشرب العصير ما دام طريا» وقال عمر: «وجدت من عبيد الله ريح شراب، وأنا سائل عنه، فإن كان يسكر جلدته»',
  context:
    'عن أبي حازم، قال: سمعت سهل بن سعد الساعدي: أن أبا أسيد الساعدي دعا النبي صلى الله عليه وسلم لعرسه، فكانت امرأته خادمهم يومئذ، وهي العروس، فقالت: «ما تدرون ما أنقعت لرسول الله صلى الله عليه وسلم؟ أنقعت له تمرات من الليل في تور» ورأى عمر، وأبو عبيدة، ومعاذ، «شرب الطلاء على الثلث» وشرب البراء، وأبو جحيفة، على النصف وقال ابن عباس: «اشرب العصير ما دام طريا» وقال عمر: «وجدت من عبيد الله ريح شراب، وأنا سائل عنه، فإن كان يسكر جلدته»',
};

const narrationOf = (row: StoredNarration): string => joinNarration(row.isnad, row.matn);
const spaced = (value: string): string => value.replace(/\s+/g, ' ').trim();

describe('splitMatn word boundaries', () => {
  it('never cuts «قالا» into «قال|ا» (Muslim 1733)', () => {
    const matn = splitMatn(narrationOf(MUSLIM_1733)).matnText;
    expect(matn.startsWith('ا ')).toBe(false);
    expect(matn).not.toMatch(/^ا?\s*حدثنا/);
    expect(matn.startsWith('قال أبو موسى أقبلت')).toBe(true);
  });

  it('never cuts «فقالت» into «فقال|ت» (Bukhari 5597)', () => {
    const matn = splitMatn(narrationOf(BUKHARI_5597)).matnText;
    expect(matn.startsWith('ت')).toBe(false);
    expect(matn.startsWith('«ما تدرون ما أنقعت')).toBe(true);
  });

  it('never cuts «فقالوا»', () => {
    const narration =
      'حدثنا قتيبة حدثنا الليث عن نافع أن ابن عمر أخبره أن الناس اجتمعوا فقالوا: «ما نرى بأسا بالصلاة في هذا الموضع حتى يأتي الإمام»';
    expect(splitMatn(narration).matnText.startsWith('وا')).toBe(false);
  });

  it('does not read «ان» inside «كان»', () => {
    const narration =
      'حدثنا فروة حدثنا علي بن مسهر عن هشام عن أبيه عن عائشة رضي الله عنها قالت: «كان رسول الله صلى الله عليه وسلم إذا انصرف من العصر دخل على نسائه»';
    expect(splitMatn(narration).matnText.startsWith('«كان رسول الله')).toBe(true);
  });

  it('takes the bracketed «(صلى الله عليه وسلم)» as salawat', () => {
    const narration =
      'أخبرنا أبو عبد الله الحافظ نا أبو العباس عن أبي هريرة قال: قال رسول الله (صلى الله عليه وسلم): " الإيمان بضع وسبعون شعبة "';
    expect(splitMatn(narration).matnText).toBe('" الإيمان بضع وسبعون شعبة "');
  });
});

describe('joinNarration', () => {
  it('glues a word an old split cut in two', () => {
    expect(narrationOf(BUKHARI_5597)).toContain('وهي العروس، فقالت: «ما تدرون');
    expect(narrationOf(MUSLIM_1733)).toContain('واللفظ لابن حاتم قالا حدثنا يحيى');
  });

  it('keeps a space between whole words', () => {
    expect(narrationOf(MUSLIM_1403)).toContain('صلى الله عليه وسلم رأى امرأة');
  });
});

describe('contextMatn', () => {
  it('keeps the Companion and the subject: Muslim 1403', () => {
    const text = contextMatn(narrationOf(MUSLIM_1403));
    expect(text.startsWith('عن جابر أن رسول الله صلى الله عليه وسلم رأى امرأة')).toBe(true);
    expect(spaced(text)).toBe(MUSLIM_1403.context);
  });

  it('keeps the question: Bukhari 751', () => {
    const text = contextMatn(narrationOf(BUKHARI_751));
    expect(text.startsWith('عن عائشة، قالت: سألت رسول الله صلى الله عليه وسلم عن الالتفات')).toBe(true);
    expect(spaced(text)).toBe(BUKHARI_751.context);
  });

  it('keeps the whole story when the Prophet ﷺ is named again inside it: Bukhari 7154', () => {
    const text = contextMatn(narrationOf(BUKHARI_7154));
    expect(splitMatn(narrationOf(BUKHARI_7154)).matnText).toBe('«إن الصبر عند أول صدمة»');
    expect(text.startsWith('ثابت البناني، قال سمعت أنس بن مالك يقول لامرأة من أهله')).toBe(true);
    expect(text).toContain('«اتقي الله، واصبري»');
    expect(spaced(text)).toBe(BUKHARI_7154.context);
  });

  it('starts before «سمعت فلانًا» and rejoins «فقالت»: Bukhari 5597', () => {
    const text = contextMatn(narrationOf(BUKHARI_5597));
    expect(text.startsWith('عن أبي حازم، قال: سمعت سهل بن سعد الساعدي: أن أبا أسيد الساعدي دعا النبي')).toBe(true);
    expect(text).toContain('وهي العروس، فقالت: «ما تدرون');
    expect(spaced(text)).toBe(BUKHARI_5597.context);
  });

  it('skips a stored matn that is still chain and starts at the name after «حدثني»: Muslim 1733', () => {
    const text = contextMatn(narrationOf(MUSLIM_1733));
    expect(text.startsWith('أبو بردة قال قال أبو موسى أقبلت إلى النبي صلى الله عليه وسلم')).toBe(true);
    expect(text).not.toContain('حدثنا');
    expect(spaced(text)).toBe(MUSLIM_1733.context);
  });

  it('starts at the last chain after «ح وحدثنا»', () => {
    const narration =
      'حدثنا محمد حدثنا عبدة عن هشام عن أبيه قال سمعت عبد الله بن جعفر قال سمعت عليا يقول سمعت رسول الله صلى الله عليه وسلم يقول ح وحدثني صدقة أخبرنا عبدة عن هشام عن أبيه قال سمعت عبد الله بن جعفر عن علي رضي الله عنهم عن النبي صلى الله عليه وسلم قال: «خير نسائها مريم، وخير نسائها خديجة»';
    const text = contextMatn(narration);
    expect(text).not.toContain('ح وحدثني');
    expect(text.endsWith('«خير نسائها مريم، وخير نسائها خديجة»')).toBe(true);
  });

  it('does not take «إن» for «أن فلانًا»', () => {
    const narration =
      'حدثنا علي حدثنا سفيان عن عاصم عن زر، قال: سألت أبي بن كعب، قلت: يا أبا المنذر إن أخاك ابن مسعود يقول كذا وكذا، فقال أبي: سألت رسول الله صلى الله عليه وسلم فقال لي: «قيل لي فقلت»';
    expect(contextMatn(narration).startsWith('عن زر، قال: سألت أبي بن كعب')).toBe(true);
  });

  it('keeps splitMatn when the narration has no narrator link', () => {
    const narration = 'هذا متن بلا إسناد طويل يكفي لاختبار الحالة التي لا تظهر فيها صيغة التحديث';
    expect(contextMatn(narration)).toBe(splitMatn(narration).matnText);
  });
});

describe('displayMatn', () => {
  it('shows the context text', () => {
    expect(spaced(displayMatn(narrationOf(MUSLIM_1403)))).toBe(MUSLIM_1403.context);
  });

  it(`keeps the old cut for a story longer than ${CONTEXT_MAX_WORDS} words`, () => {
    const story = Array.from({ length: CONTEXT_MAX_WORDS }, (_, index) => `كلمة${index}`).join(' ');
    const narration = `حدثنا مسدد حدثنا يحيى عن أنس قال ${story} فقال رسول الله صلى الله عليه وسلم: «يسروا ولا تعسروا»`;
    expect(contextMatn(narration).startsWith('عن أنس قال')).toBe(true);
    expect(displayMatn(narration)).toBe('«يسروا ولا تعسروا»');
  });
});

describe('matnForMatching', () => {
  it('matches a stored context text on splitMatn\'s words', () => {
    const matnAr = contextMatn(narrationOf(MUSLIM_1403));
    expect(startsWithNarratorLead(matnAr)).toBe(true);
    expect(matnForMatching({ textAr: MUSLIM_1403.matn, matnAr })).toBe(MUSLIM_1403.matn);
  });

  it('matches a name-led context text on splitMatn\'s words', () => {
    const matnAr = contextMatn(narrationOf(MUSLIM_1733));
    expect(startsWithNarratorLead(matnAr)).toBe(true);
    expect(matnForMatching({ textAr: '', matnAr })).toBe(splitMatn(matnAr).matnText);
  });

  it('keeps a stored matn without a narrator lead as it is', () => {
    const matnAr = 'قال رسول الله صلى الله عليه وسلم: «إنما الأعمال بالنيات» فقال النبي صلى الله عليه وسلم: «وإنما لكل امرئ ما نوى»';
    expect(startsWithNarratorLead(matnAr)).toBe(false);
    expect(matnForMatching({ textAr: 'x', matnAr })).toBe(matnAr);
  });

  it('falls back to splitMatn(textAr)', () => {
    const textAr = narrationOf(MUSLIM_1403);
    expect(matnForMatching({ textAr, matnAr: null })).toBe(splitMatn(textAr).matnText);
  });
});
