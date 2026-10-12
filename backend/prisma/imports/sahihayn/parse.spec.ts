import { describe, expect, it } from 'vitest';
import { parseSahihayn } from './parse.js';

const BUKHARI = `#META#Header#End#
### | ( باب بدء الوحي )
### || ( 1 باب كيف كان بدء الوحي إلى رسول الله صلى الله عليه وسلم )
# 1 حدثنا الحميدي عبد الله بن الزبير قال حدثنا سفيان قال سمعت رسول الله
~~صلى الله عليه وسلم يقول * إنما الأعمال بالنيات وإنما لكل امرئ ما نوى
# 2 حدثنا عبد الله بن يوسف قال أخبرنا مالك عن هشام بن عروة عن أبيه عن
~~عائشة أن رسول الله صلى الله عليه وسلم قال يا رسول الله كيف يأتيك الوحي
### | ( 2 كتاب الإيمان )
### || ( باب الإيمان )
# 8 حدثنا عبيد الله بن موسى قال أخبرنا حنظلة عن عكرمة عن ابن عمر قال قال
~~رسول الله صلى الله عليه وسلم بني الإسلام على خمس
# 2 باب قول الله تعالى وإذ قال ربك للملائكة
`;

const MUSLIM = `#META#Header#End#
# | 1 ( 2 باب تغليظ الكذب على رسول الله صلى الله عليه وسلم )
# 1 وحدثنا أبو بكر بن أبي شيبة حدثنا غندر عن شعبة قال قال رسول الله
~~صلى الله عليه وسلم * لا تكذبوا علي فإنه من يكذب علي يلج النار
# 1 وحدثنا طريق أقصر بمثل حديثهم
# | 1 ( 1 كتاب الإيمان )
# | 1 ( 8 باب بيان الإيمان )
# 8 وحدثنا يحيى بن يحيى قال أخبرنا هشيم عن أبي جمرة عن ابن عباس قال قال
~~رسول الله صلى الله عليه وسلم بني الإسلام على خمس
# 291429132913 2913 وحدثنا زهير بن حرب بعد رقم ملتصق في النص
`;

describe('parseSahihayn', () => {
  it('numbers Bukhari narrations and treats a bab line as a chapter', () => {
    const parsed = parseSahihayn(BUKHARI);
    expect(parsed.narrations.map((row) => row.number)).toEqual([1, 2, 8]);
    expect(parsed.missing).toEqual([3, 4, 5, 6, 7]);
    expect(parsed.duplicateNumbers).toEqual([]);
    expect(parsed.narrations[0]?.text).toContain('إنما الأعمال بالنيات');
    expect(parsed.narrations[0]?.text).not.toContain('*');
    expect(parsed.narrations[2]?.kitab).toContain('كتاب الإيمان');
    expect(parsed.narrations[0]?.bab).toContain('كيف كان بدء الوحي');
  });

  it('keeps the longer Muslim text when one number is repeated', () => {
    const parsed = parseSahihayn(MUSLIM);
    expect(parsed.duplicateNumbers).toEqual([1]);
    const first = parsed.narrations.find((row) => row.number === 1);
    expect(first?.text).toContain('لا تكذبوا علي');
    expect(parsed.narrations.find((row) => row.number === 8)?.kitab).toContain('كتاب الإيمان');
    expect(parsed.narrations.some((row) => row.number === 2913)).toBe(true);
    expect(parsed.maxNumber).toBeLessThan(20_000);
  });
});
