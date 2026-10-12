import { describe, expect, it } from 'vitest';
import { splitMatn } from './matn.js';

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
