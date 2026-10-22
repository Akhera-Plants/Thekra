import { describe, expect, it } from 'vitest';
import { parseMuslimBook, parseOpenitiBook, parseTarghibStructure } from './parse.js';

const RIYAD = `#META#Header#End#
### | (17) - كتاب الأمور المنهي عنها
### $ 254 - باب تحريم الغيبة والأمر بحفظ اللسان
# قال الله تعالى: {ولا يغتب بعضكم بعضا} [الحجرات: 12]، وقال تعالى: {ولا تقف ما ليس لك به علم} [الإسراء: 36]، وقال تعالى: {ما يلفظ من قول إلا لديه رقيب عتيد} [ق: 18].
# اعلم أنه ينبغي لكل مكلف أن يحفظ لسانه عن جميع الكلام إلا كلاما ظهرت فيه المصلحة
### | 1511 -
# وعن أبي هريرة قال: «من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت» متفق عليه.
# وهذا صريح في أنه ينبغي أن لا يتكلم إلا إذا كان الكلام خيرا.
`;

const BUKHARI = `#META#Header#End#
### $ 2 - كتاب الإيمان
### | باب: {فإن تابوا وأقاموا الصلاة} [التوبة: 5]
### | 25 -
# حدثنا عبد الله بن محمد قال: «أمرت أن أقاتل الناس»
### | باب {وإن طائفتان من المؤمنين اقتتلوا} [الحجرات: 9]
# فسماهم المؤمنين
### | 31 -
# حدثنا عبد الرحمن بن المبارك قال: «إذا التقى المسلمان بسيفيهما»
`;

describe('book structure', () => {
  it('keeps the ghibah chapter in the author order', () => {
    const sections = parseOpenitiBook(RIYAD, 'riyad');
    expect(sections.map((section) => [section.level, section.number, section.parentIndex])).toEqual([
      ['KITAB', '17', null],
      ['BAB', '254', 0],
    ]);
    const items = sections[1]?.items ?? [];
    expect(items.map((item) => item.kind)).toEqual([
      'AYAH',
      'AYAH',
      'AYAH',
      'AUTHOR_TEXT',
      'HADITH',
      'AUTHOR_TEXT',
    ]);
    expect(items.slice(0, 3).map((item) => item.ayahFrom)).toEqual(['49:12', '17:36', '50:18']);
    expect(items[4]).toMatchObject({ kind: 'HADITH', hadithNumber: 1511 });
    expect(items[4]?.text).toContain('فليقل خيرا');
    expect(items[5]?.text).toContain('وهذا صريح');
  });

  it('puts a Bukhari tarjama, including its ayat, under the kitab', () => {
    const sections = parseOpenitiBook(BUKHARI, 'bukhari');
    expect(sections.map((section) => section.level)).toEqual(['KITAB', 'BAB', 'BAB']);
    expect(sections[1]?.parentIndex).toBe(0);
    expect(sections[1]?.items.map((item) => [item.kind, item.ayahFrom ?? item.hadithNumber])).toEqual([
      ['AYAH', '9:5'],
      ['HADITH', 25],
    ]);
    expect(sections[2]?.items.map((item) => item.kind)).toEqual(['AYAH', 'AUTHOR_TEXT', 'HADITH']);
    expect(sections[2]?.items[1]?.text).toContain('فسماهم المؤمنين');
  });

  it('nests a Muslim bab under its kitab', () => {
    const source = `#META#Header#End#
# | 1 ( 8 كتاب الإيمان )
# | 1 ( 1 باب بيان الإيمان والإسلام )
# 8 حدثني أبي قال: «الإيمان أن تؤمن بالله»
`;
    const sections = parseMuslimBook(source);
    expect(sections.map((section) => [section.level, section.number, section.parentIndex])).toEqual([
      ['KITAB', '8', null],
      ['BAB', '1', 0],
    ]);
    expect(sections[1]?.items[0]).toMatchObject({ kind: 'HADITH', hadithNumber: 8 });
  });

  it('reads the real hadith number when a Muslim line repeats it', () => {
    const source = `#META#Header#End#
# | 1 ( 1 كتاب الإيمان )
# 291429132913 2913 وحدثني زهير بن حرب
`;
    const sections = parseMuslimBook(source);
    expect(sections.at(-1)?.items[0]).toMatchObject({ kind: 'HADITH', hadithNumber: 2913 });
    expect(sections.at(-1)?.items[0]?.text).toContain('زهير بن حرب');
  });

  it('keeps one Targhib kitab when the running header repeats with the page numbers', () => {
    const source = `[[1:1]]
١ - كتاب الإخلاص ١ - الترغيب في الإخلاص والصدق .
١ - (١٠) حدثنا عبد الله بن يوسف قال حدثنا مالك عن نافع عن ابن عمر أن رسول الله صلى الله عليه وسلم قال إنما الأعمال بالنيات
[[1:2]]
كتاب الإخلاص ١ - الترغيب في الإخلاص والصدق . ١١ و ١٢ ـ حديث
٢ - (١١) حدثنا قتيبة بن سعيد قال حدثنا عبد العزيز عن أبيه عن سهل قال قال رسول الله صلى الله عليه وسلم إن في الجنة بابا يقال له الريان
`;
    const sections = parseTarghibStructure(source);
    expect(sections.map((section) => [section.level, section.titleAr])).toEqual([
      ['KITAB', 'كتاب الإخلاص'],
      ['TARGHIB', 'الترغيب في الإخلاص والصدق'],
    ]);
    expect(sections[1]?.items.filter((item) => item.kind === 'HADITH')).toHaveLength(2);
  });

  it('splits a Targhib header when the OCR drops the alif and repeats the kitab', () => {
    const source = `[[1:3]]
كتاب النوافل ١٤ - االترغيب في آيات وأذكار يقولها إذا أصبح
٣ - (١٢) حدثنا عبد الله بن يوسف قال حدثنا مالك عن نافع عن ابن عمر أن رسول الله صلى الله عليه وسلم قال من قال حين يصبح
[[1:4]]
كتاب والسنة ١ - الترغيب في اتباع الكتاب والسنة
٤ - (١٣) حدثنا قتيبة بن سعيد قال حدثنا عبد العزيز عن أبيه عن سهل قال قال رسول الله صلى الله عليه وسلم من أحيا سنة من سنتي
[[1:5]]
كتاب السنة ١ - الترغيب في اتباع الكتاب والسنة
٥ - (١٤) حدثنا آدم قال حدثنا شعبة عن عبد الملك قال سمعت قزعة قال سمعت أبا سعيد قال قال رسول الله صلى الله عليه وسلم من صام يوما
`;
    const sections = parseTarghibStructure(source);
    expect(sections.map((section) => [section.level, section.titleAr])).toEqual([
      ['KITAB', 'كتاب النوافل'],
      ['TARGHIB', 'الترغيب في آيات وأذكار يقولها إذا أصبح'],
      ['KITAB', 'كتاب والسنة'],
      ['TARGHIB', 'الترغيب في اتباع الكتاب والسنة'],
    ]);
    expect(sections[3]?.items.filter((item) => item.kind === 'HADITH')).toHaveLength(2);
  });
});
