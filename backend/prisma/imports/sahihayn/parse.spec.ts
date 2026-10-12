import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { splitMatn } from '../../../src/common/text/matn.js';
import { parseSahihayn, parseShamelaBukhari } from './parse.js';

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

const SHAMELA = `#META#Header#End#
### | 1 -
# باب
### | بدء الوحي
### | كيف كان بدء الوحي إلى رسول الله صلى الله عليه وسلم؟
### | 1 -
# حدثنا الحميدي عبد الله بن الزبير، قال: حدثنا سفيان، قال: سمعت رسول الله صلى الله عليه وسلم يقول: «إنما الأعمال بالنيات»
### | 69 ms0034 -
# حدثنا محمد بن بشار، قال: حدثنا يحيى، قال: قال رسول الله صلى الله عليه وسلم: «يسروا ولا تعسروا»
### | 3261 -
# حدثني عبد الله بن محمد، قال: قال رسول الله صلى الله عليه وسلم: «الحمى من فيح جهنم فأبردوها بالماء»
### | 6094 -
# حدثنا عثمان بن أبي شيبة، قال: قال رسول الله صلى الله عليه وسلم: «إن الصدق يهدي إلى البر»
### | 7563 -
# حدثني أحمد بن إشكاب، قال: قال رسول الله صلى الله عليه وسلم: «كلمتان حبيبتان إلى الرحمن»
`;

describe('parseShamelaBukhari', () => {
  it('keeps Abdul Baqi numbers and the longer text when 1 is repeated', () => {
    const parsed = parseShamelaBukhari(SHAMELA);
    expect(parsed.narrations.map((row) => row.number)).toEqual([1, 69, 3261, 6094, 7563]);
    expect(parsed.narrations[0]?.text).toContain('إنما الأعمال بالنيات');
    expect(parsed.narrations[0]?.text).not.toBe('باب');
    expect(parsed.narrations.find((row) => row.number === 6094)?.text).toContain('إن الصدق يهدي إلى البر');
    expect(parsed.narrations.find((row) => row.number === 3261)?.text).toContain('الحمى من فيح جهنم');
    expect(parsed.narrations.find((row) => row.number === 7563)?.text).toContain('كلمتان حبيبتان');
    expect(parsed.maxNumber).toBe(7563);
  });

  it('matches the pinned files on the printed anchors', () => {
    const bukhariPath = new URL('../../../.corpus/0256Bukhari.Sahih.Shamela0001681-ara1', import.meta.url);
    const muslimPath = new URL('../../../.corpus/0261Muslim.Sahih.JK000109-ara1', import.meta.url);
    if (!existsSync(bukhariPath) || !existsSync(muslimPath)) return;
    const bukhari = parseShamelaBukhari(readFileSync(bukhariPath, 'utf8'));
    const at = (number: number) => bukhari.narrations.find((row) => row.number === number)?.text ?? '';
    expect(at(1)).toContain('إنما الأعمال بالنيات');
    expect(at(6094)).toContain('إن الصدق يهدي إلى البر');
    expect(at(3261)).toContain('الحمى من فيح جهنم');
    expect(at(7563)).toContain('كلمتان حبيبتان إلى الرحمن');
    expect(bukhari.maxNumber).toBe(7563);

    const muslim = parseSahihayn(readFileSync(muslimPath, 'utf8'));
    const muslimAt = (number: number) => muslim.narrations.find((row) => row.number === number)?.text ?? '';
    expect(muslimAt(8)).toContain('جبريل');
    expect(muslimAt(2564)).toContain('لا تحاسدوا ولا تناجشوا');
    expect(muslim.maxNumber).toBe(3033);

    const startsWithIsnad = (text: string) => /^(?:و?حدثنا|و?حدثني|و?أخبرنا|و?أخبرني)/.test(splitMatn(text).matnText);
    const bukhariBad = bukhari.narrations.filter((row) => startsWithIsnad(row.text)).length;
    const muslimBad = muslim.narrations.filter((row) => startsWithIsnad(row.text)).length;
    expect(bukhariBad).toBeLessThan(40);
    expect(muslimBad).toBeLessThan(60);
  });
});
