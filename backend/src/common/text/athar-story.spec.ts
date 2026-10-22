import { describe, expect, it } from 'vitest';
import { atharContentCue, classifyNarration, extractAtharStory, foldArabic } from './athar-classify.js';

/**
 * Real rows from docs/build/SHUAB_ATHAR_REPORT.md «Athar audit» (seed 20261024),
 * plus Mutarrif's story which must stay whole.
 */
describe('extractAtharStory — audit sample', () => {
  it('#3 أبو ذر / الزهد 561 — footnote mash is OCR, not a story', () => {
    const text =
      '( ٥٦١ ) أخبرنا شعبة بن الحجاج عن أبي عمران الجوني عن عبد الصامت عن أبي ذر قال : « أوصاني خليلي إذا صنعت بن حمزة بن عبد الله بن عمر : : ثقة ( ٢٠٤ ) . ابن عمر ( ٥٩٧ ) . رواه أحمد بمعناه في الزهد ( ١٩٤ ) وأبو نعيم ( ۱ / ۲۹۸ ، ۲۹۹ ) من طريق عبد الرزاق عن معمر . وأبو داود في الزهد ( ۳۱۸ ) . وقوله : ( ظمأ حمار ) إشارة إلى قرب أجله ، والحمار هو أسرع الدواب ظماً . ( ٦١ ٥) صحيح رواه مسلم وغيره . شعبة بن الحجاج ( ٤٠٩ ) . أبو عمران الجوني ( ٤٧٤ ) . عبد الله بن الصامت : ثقة ( ٥٨٢ ) . مرقا فأكثر ماءها ثم انظر إلى أهل بيت من جيرانك فأصبهم بمعروف ) .';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(false);
    if (!result.kept) expect(result.reason).toBe('ocr');
  });

  it('#4 مجاهد / شعب 1943 — cut the next chain «قال: وحدثنا»', () => {
    const text =
      'أخبرنا أبو نصر بن قتادة، أخبرنا أبو منصور النضروي، حدثنا أحمد بن نجدة، حدثنا سعيد بن منصور، حدثنا عبد الله بن المبارك، عن عبد العزيز بن أبي رواد، عن مجاهد، قال: " كان ربما قرأ وقوم نيام فيجد الريح، فيمسك عن القراءة حتى تذهب " قال: وحدثنا عبد الله بن المبارك، عن عثمان بن الأسود، عن حميد الأعرج، عن مجاهد، قال: " إذا تثاوبت وأنت تقرأ، فأمسك عن القراءة حتى يذهب عنك "';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(result.text).toContain('كان ربما قرأ');
    expect(result.text).not.toContain('وحدثنا');
    expect(result.attribution).toBe('SAID');
    expect(result.speakerRaw).toContain('مجاهد');
  });

  it('#8 أبو هريرة / شعب 6879 — drop «هكذا جاء موقوفا»', () => {
    const text =
      'أخبرنا أبو عبد الله الحافظ، نا أبو أحمد بن بكر بن محمد بن حمدان الصيرفي، نا أبو الأحوص محمد بن الهيثم القاضي، حدثني إسماعيل بن أبي أويس، نا سليمان بن بلال، عن يونس، عن ابن شهاب، عن أبي حميد، عن أبي هريرة، قال: " أحذركم محقرات هذه الأعمال، وإنها تحصى عليكم، وترد عليكم ". هكذا جاء موقوفا';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(result.text).toContain('أحذركم محقرات');
    expect(result.text).not.toContain('موقوفا');
    expect(result.attribution).toBe('SAID');
  });

  it('#21 مسروق / ابن أبي الدنيا 229 — only «قالت عائشة»', () => {
    const text =
      'حدثنا أبو خيثمة، حدثنا جرير، عن الأعمش، عن أبي وائل، عن مسروق، قال: قالت عائشة رضي الله عنها';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(false);
    if (!result.kept) expect(result.reason).toBe('frame-only');
  });

  it('#28 الحسن / شعب 2963 — starts mid-dialogue «سبحان الله وما له؟ قالت»', () => {
    const text =
      'أخبرنا أبو الحسين بن الفضل، حدثنا عبد الله بن جعفر، حدثنا أبو يوسف يعقوب بن سفيان، أخبرني بعض شيوخأهل الكوفة، قال: كان لهم - يعني لآل الحسن بن صالح بن حي - خادم تخدمهم، فاحتاجوا إلى بيعها فباعوها، فلما كان في أول الليل ذهبت وألحت على مولاها تقيمه، وتقول: ذهب الليل، مرة بعد مرة حتى أضجرته، فصاح بها، قال: فلما أصبحت ذهبت إلى الحسن، فقالت: يا سبحان الله أما كان يجب عليكم فيما خدمتكم أن تبيعوني من مسلم قال: فقال الحسن: " سبحان الله وما له؟ " قالت: انتظرت أن يقوم ليتهجد فلم يفعل، فألححت عليه فزبرني وشتمني، قال: فصاح: لعلي، وقال: " أما تعجب من هذه، اذهب فتسلف ثمنها من بعض إخواننا وأعتقها "';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(false);
    if (!result.kept) expect(result.reason).toBe('mid-dialogue');
  });

  it('#34 الحسن / شعب 5968 — keep Ibn Umar inside the story, cut «فصل في»', () => {
    const text =
      'أخبرنا أبو عبد الله الحافظ، أنا أبو عبد الله الصنعاني، ثنا إسحاق بن إبراهيم، أنا عبد الرزاق، عن معمر، عن قتادة، عن الحسن قال: " كان يكره المفضض فإن سقي فيه شرب قال: وكان ابن عمر إذا سقي فيه كسره " فصل في كراهية نتف الشيب';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(result.text).toContain('ابن عمر');
    expect(result.text).not.toContain('فصل');
    expect(result.attribution).toBe('SAID');
  });

  it('#36 قتادة / الزهد 426 — only «قال أبو الدرداء»', () => {
    const text =
      'أخبركم أبو عمر بن حيويه قال: حدثنا يحيى قال: حدثنا الحسين قال: أخبرنا ابن المبارك قال: أخبرنا معمر، عن قتادة قال: قال أبو الدرداء';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(false);
    if (!result.kept) expect(result.reason).toBe('frame-only');
  });

  it('#58 الحسن / شعب 2554 — fragment plus «أخرجه مسلم»', () => {
    const text =
      'أخبرنا أبو بكر القاضي، حدثنا حاجب بن أحمد، حدثنا محمد بن حماد، حدثنا أبو معاوية، ح وأخبرنا محمد بن عبد الله الحافظ، حدثنا عبد الله بن محمد بن موسى، حدثنا محمد بن أيوب، حدثنا أبو بكر بن أبي شيبة، حدثنا أبو معاوية، فذكره بإسناده على لفظ الفقيه، غير أنه قال قال الحسن: " وما يبقي ذلك من الدرن؟ " أخرجه مسلم في الصحيح عن أبي بكر بن أبي شيبة';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(false);
    if (!result.kept) expect(result.reason).toBe('short');
  });

  it('Mutarrif keeps «فذكرت ذلك للحسن فقال: صدق مطرف»', () => {
    const text =
      'أخبرنا أبو الحسين بن الفضل القطان، ببغداد، أنا عبد الله بن جعفر النحوي، نا يعقوب بن سفيان، نا عمرو بن عاصم، نا سليمان بن المغيرة، عن غيلان بن جرير، قال: قال مطرف: " ما تحاب اثنان في الله كان أشدهما حبا لصاحبه أفضلهما ". قال: فذكرت ذلك للحسن فقال: صدق مطرف قال: وقال غيلان: قال مطرف: " أنا لمذعور أشد حبا وهو أفضل مني، فكيف هذا؟ "';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(result.text).toContain('ما تحاب اثنان');
    expect(result.text).toContain('فذكرت ذلك للحسن');
    expect(result.text).toContain('صدق مطرف');
    expect(result.text).not.toContain('أبو الحسين');
    expect(result.speakerRaw).toContain('مطرف');
    expect(result.attribution).toBe('SAID');
  });

  it('al-Hasan narrating عامر بن عبد قيس is NARRATED («رواه»)', () => {
    const text =
      'حدثنا عبد الرحمن بن صالح، عن الحسن قال: دخل عامر بن عبد الله على رجل يعوده، فرآه كأنه جزع من الموت، فقال: «أتجزع من الموت؟ والله ما الموت فيما بعده إلا كركضه عنز»';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(result.text).toContain('عامر بن عبد الله');
    expect(result.attribution).toBe('NARRATED');
    expect(result.speakerRaw).toContain('الحسن');
  });

  it('al-Hasan reporting what Umar ate is NARRATED', () => {
    const text =
      'عن الحسن، قال: ما أكل عمر بن الخطاب إلا مغلوثا بشعير حتى لحق بالله، وكان بطنه ربما قرقر';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(result.attribution).toBe('NARRATED');
  });
});

/** Real rows from docs/build/SHUAB_ATHAR_REPORT.md «Athar audit 2» (seed 20261025). */
describe('extractAtharStory — audit 2', () => {
  it('#4 أبو هريرة / شعب 2853 — «نهينا» is marfu by ruling', () => {
    const text =
      'أخبرنا علي بن أحمد بن عبدان، حدثنا أحمد بن عبيد الصفار، حدثنا إسماعيل بن أبي كثير، حدثنا مكي بن إبراهيم، حدثنا هشام بن حسان، عن محمد بن سيرين، عن أبي هريرة، قال: نهينا عن الاختصار في الصلاة قال: فسألت محمدا عن ذلك، فقال: " يقول الرجل بيديه أو بإحداهما هكذا ووضع يده في خصره " أخرجه مسلم والبخاري في الصحيح من حديث هشام وغيره';
    expect(classifyNarration(text).kind).toBe('MARFU');
    expect(classifyNarration('عن ابن عمر، قال: أمرنا أن نخرج الحيض يوم العيدين').kind).toBe('MARFU');
    expect(classifyNarration('عن ابن عمر، قال: كنا نؤمر بالسكينة').kind).toBe('MARFU');
    expect(classifyNarration('عن ابن عمر، قال: كنا ننهى عن النذر').kind).toBe('MARFU');
    expect(classifyNarration('عن ابن عباس، قال: من السنة أن لا يقتل الحر بالعبد').kind).toBe('MARFU');
    expect(classifyNarration('عن ابن عمر، قال: أمر الناس أن يكون آخر عهدهم بالبيت').kind).toBe('MARFU');
  });

  it('#38 أبو هريرة / شعب 7390 — cut «وهذا موقوف وإسناده صحيح»', () => {
    const text =
      'أخبرنا علي بن أحمد بن عبدان، أنا أحمد بن عبيد، نا إسماعيل بن إسحاق، نا عبد الله بن عبد الوهاب، نا عبد الواحد يعني ابن زياد، نا عمارة بن القعقاع، عن أبي زرعة، عن أبي هريرة، قال: " نعم البيت الحمام، يذهب الدرن، ويذكر النار " وهذا موقوف وإسناده صحيح';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(result.text.endsWith('ويذكر النار')).toBe(true);
    expect(result.text).not.toContain('موقوف');
    expect(result.text).not.toContain('إسناده');
  });

  it('#10 ابن سيرين — «قام رجل» is narrated, not his own words', () => {
    const text =
      'وبإسناده عن ابن سيرين، قال: قام رجل إلى معاوية كأنه سفود محترق، فقال: يا معاوية، والله لتستقيمن أو لنقومنك. قال معاوية: بماذا؟ قال: بالقتل. قال: إذا نستقيم يا أعرابي. ونقلت من الجزء الثاني ، وليس فيه سماعي:';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(result.speakerRaw).toContain('ابن سيرين');
    expect(result.attribution).toBe('NARRATED');
  });

  it('#33 مجاهد / شعب 10197 — «مررنا» then Ibn Umar is narrated', () => {
    const text =
      'أخبرنا أبو عبد الله الحافظ، نا أبو عبد الله الصفار، نا أبو بكر بن أبي الدنيا، نا عبد الرحمن بن صالح، عن مالك بن مغول، عن مجاهد، قال: مررنا بخربة فقال لي ابن عمر:" يا مجاهد، قل: يا خربة ما فعل أهلك؟ " فأجابني ابن عمر فقال:" هلكوا وبقيت أعمالهم"';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(result.speakerRaw).toContain('مجاهد');
    expect(result.attribution).toBe('NARRATED');
  });

  it('#26 حذيفة / شعب 10258 — question then Salman answers is narrated, never «— حذيفة»', () => {
    const text =
      'أخبرنا أبو عبد الله الحافظ، أنا أبو عبد الله، نا أبو بكر بن أبي الدنيا، نا الحسن بن يحيى، أنا عبد الرزاق، أنا معمر، عن يزيد بن أبي زياد قال: قال حذيفة لسلمان: ألا تبني لك مسكنا يا أبا عبد الله؟، قال: " لم تجعلني ملكا أو تجعل لي بيتا مثل دارك التي بالمدائن؟ "، قال: لا، ولكن نبني لك بيتا من قصبة، ونسقفه بالبردي أو بالبوري، إذا قمت كاد أن يصيب رأسك، وإذا نمت كاد أن يمس طرفيك. قال: " فكأنك كنت في نفسي ".';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(foldArabic(result.speakerRaw)).toContain(foldArabic('حذيفة'));
    expect(result.attribution).toBe('NARRATED');
  });

  it('#22 ابن عباس / شعب 165 — «أعينوا عباد الله» is not publishable', () => {
    const text =
      'أخبرنا علي بن أحمد بن عبدان، حدثنا أحمد بن عبيد الصفار، حدثنا عبيد بن شريك، حدثنا ابن أبي مريم، حدثنا عبد الله بن فروخ، أخبرني أسامة بن زيد، حدثني أبان بن صالح، عن مجاهد، عن ابن عباس قال: " إن لله عز وجل ملائكة سوى الحفظة يكتبون ما سقط من ورق الشجر، فإذا أصاب أحدكم عرجة بأرض فلاة فليناد أعينوا عباد الله يرحمكم الله تعالى "';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(false);
    if (!result.kept) expect(result.reason).toBe('content');
    expect(atharContentCue(text)).toBe('أعينوا عباد الله');
  });

  it('#25 زيد بن أسلم / شعب 10285 — «العمالقة» is not publishable', () => {
    const text =
      'أخبرنا أبو طاهر الفقيه، أنا حاجب بن أحمد، نا محمد بن حماد، نا أبو ضمرة أنس بن عياض الليثي قال: سمعت زيد بن أسلم يقول: " بلغني أنه رئيت ضبع وأولادها رابضة في حجاج عين رجل من العمالقة "';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(false);
    if (!result.kept) expect(result.reason).toBe('content');
    expect(atharContentCue(text)).toBe('العمالقة');
  });
});

/** Real rows from docs/build/SHUAB_ATHAR_REPORT.md «Athar audit 3» (seed 20261026). */
describe('extractAtharStory — audit 3', () => {
  it('#41 أبو ذر / شعب 3200 — cut «هكذا موقوفا»', () => {
    const text =
      'أخبرنا أبو محمد السكري، حدثنا إسماعيل الصفار، حدثنا أحمد بن منصور، حدثنا عبد الرزاق، حدثنا الثوري، عن عمار الدهني، عن راشد بن الحارث، عن أبي ذر، قال: " ما خرجت صدقة يعني يفك عنها لحيي سبعين شيطانا كلهم ينهى عنها "، هكذا موقوفا التصدق من كسب طيب';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(true);
    if (!result.kept) return;
    expect(result.text.endsWith('كلهم ينهى عنها')).toBe(true);
    expect(result.text).not.toContain('موقوفا');
  });

  it('#22 علي / ابن أبي الدنيا 7 — gesture and a dotted gap are not a story', () => {
    const text =
      'حدثنا خلف بن هشام قال : حدثنا أبو شهاب الحناط ، عن | عمرو بن قيس الملائي ، عن أبي إسحاق ، عن عاصم بن ضمرة ، عن علي | قال : إن أبواب جهنم هكذا بعضها فوق بعض . وأومأ أبو شهاب | بأصابعه . . . . هذا عن هذا .';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(false);
    if (!result.kept) expect(result.reason).toBe('gesture');
  });

  it('#44 ابن عباس / ابن أبي الدنيا 275 — «. . .» is not a story', () => {
    const text =
      'حدثنا عبد الله قال: وحدثنا أحمد بن إبراهيم، قال: حدثنا خلف بن تميم، قال: حدثنا إسماعيل بن إبراهيم بن مهاجر، قال: سمعت أبي يذكره، عن مجاهد، عن ابن عباس، قال: «إن الأرض. . . في أعين الناس إذا كان عليها إمام عادل، وإنها لتفتح في أعين الناس إذا كان عليها إمام جائر، وإنها لتخرج في زمان الإمام العادل، تزكو ما لا تزكو في زمان الجائر»';
    const result = extractAtharStory(text);
    expect(result.kept).toBe(false);
    if (!result.kept) expect(result.reason).toBe('gap');
  });
});
