import { HadithGrade } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { parseRiyad, parseTarghib, parseZuhd } from './parse.js';

const TARGHIB = `
[[1:1]]
كتاب الإخلاص
الترغيب في الإخلاص والصدق
صحيح
١ - (١) عن ابن عمر قال سمعت رسول الله صلى الله عليه وسلم يقول انطلق ثلاثة نفر ممن كان قبلكم حتى أواهم المبيت إلى غار
[[1:2]]
فانفرجت الصخرة فخرجوا يمشون
٢ - (٢) وعن أبي هريرة قال قال رسول الله صلى الله عليه وسلم الإيمان بضع وسبعون شعبة
حسن
٣ - (١٢) وعن أبي موسى قال قال رسول الله صلى الله عليه وسلم من أحب لقاء الله أحب الله لقاءه ومن كره لقاء الله كره الله لقاءه
ص لغيره قال أبو موسى
٤ - (١٣) وعن أبي هريرة قال قال رسول الله صلى الله عليه وسلم من مات في سبيل ص لغيره الله فهو شهيد
٨ - (٨) كمثال فاضح لبعض السرقات في هذا الموضع من مقدمة الكتاب وليس حديثا
`.trim();

const RIYAD = `
[[1:44]]
١ - الجمع بين الصحيحين للحميدي وذكر عن البخاري في هذا الفهرس الطويل الذي ليس حديثا مرفوعا الى النبي
باب الإخلاص وإحضار النية في جميع الأعمال
٢ ـ وعن عائشة قالت قال رسول الله صلى الله عليه وسلم يغزو جيش الكعبة فإذا كانوا ببيداء من الأرض يخسف بأولهم وآخرهم
متفق عليه
حسن
٣ - وعن أبي هريرة قال قال رسول الله صلى الله عليه وسلم صلاة الرجل في جماعة تزيد على صلاته في بيته
رواه أبو داود والترمذي
`.trim();

const ZUHD = `
[[1:201]]
( ١٣٧ ) أخبرنا رشدين بن سعد عن عمرو بن الحارث أن عائشة قالت ما رأيت رسول الله صلى الله عليه وسلم مستجمعا ضاحكا
( ١٣٨ ) أخبرنا قيس بن الربيع عن أبي حصين عن يحيى بن وثاب عن مسروق عن عبد الله قال إذا كان يوم صوم أحدكم فليصبح مترجلا
`.trim();

describe('waqfeya parsers', () => {
  it('reads Albani margin grades onto the hadith that carries them', () => {
    const { narrations, chapters } = parseTarghib(TARGHIB);
    expect(narrations.map((row) => [row.number, row.grade, row.page])).toEqual([
      [1, HadithGrade.SAHIH, '1'],
      [2, HadithGrade.HASAN, '2'],
      [3, HadithGrade.SAHIH, '2'],
      [4, HadithGrade.SAHIH, '2'],
    ]);
    expect(narrations[0]?.textAr).not.toContain('صحيح');
    expect(narrations[0]?.gradeToken).toBe('صحيح');
    expect(narrations[1]?.gradeToken).toBe('حسن');
    expect(narrations[2]?.gradeToken).toBe('صحيح لغيره');
    expect(narrations[2]?.textAr).not.toContain('لغيره');
    expect(narrations[2]?.textAr).toContain('قال أبو موسى');
    expect(narrations[3]?.gradeToken).toBe('صحيح لغيره');
    expect(narrations[3]?.textAr).toContain('سبيل الله');
    expect(narrations[3]?.textAr).not.toContain('لغيره');
    expect(chapters.map((chapter) => chapter.titleAr)).toEqual(
      expect.arrayContaining([expect.stringContaining('الترغيب في الإخلاص')]),
    );
  });

  it('grades Riyad only from the three takhrij phrases', () => {
    const { narrations } = parseRiyad(RIYAD);
    expect(narrations.map((row) => [row.number, row.grade, row.gradeToken])).toEqual([
      [2, HadithGrade.SAHIH, 'متفق عليه'],
      [3, HadithGrade.UNGRADED, null],
    ]);
    expect(narrations[0]?.takhrij).toContain('متفق عليه');
    expect(narrations[0]?.chapterTitle).toContain('باب الإخلاص');
  });

  it('splits Zuhd on the parenthesized narration number and leaves it ungraded', () => {
    const { narrations, chapters } = parseZuhd(ZUHD);
    expect(narrations.map((row) => row.number)).toEqual([137, 138]);
    expect(narrations.every((row) => row.grade === HadithGrade.UNGRADED)).toBe(true);
    expect(chapters).toEqual([]);
  });
});
