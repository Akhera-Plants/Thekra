import { describe, expect, it } from 'vitest';
import { parseKabairSections, parseMinhajSections, parseNumberedBook } from './parse.js';

const NUMBERED = `#META#Header#End#
### | باب الإخلاص وإحضار النية
# عن عمر بن الخطاب رضي الله عنه قال
~~ سمعت رسول الله صلى الله عليه وسلم يقول إنما الأعمال بالنيات وإنما لكل امرئ ما نوى وهذا نص يكفي للاختبار هنا
### | 1 -
# عن عمر بن الخطاب رضي الله عنه قال
~~ سمعت رسول الله صلى الله عليه وسلم يقول إنما الأعمال بالنيات وإنما لكل امرئ ما نوى فمن كانت هجرته إلى الله ورسوله
### | 2 -
# عن أبي هريرة
~~ قال رسول الله صلى الله عليه وسلم من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت وهذا نص يكفي للاختبار
`;

describe('parseNumberedBook', () => {
  it('keeps the chapter over the numbered narrations', () => {
    const pieces = parseNumberedBook(NUMBERED);
    expect(pieces.map((piece) => piece.number)).toEqual([1, 2]);
    expect(pieces[0]?.title).toContain('باب الإخلاص');
    expect(pieces[0]?.textAr).toContain('إنما الأعمال بالنيات');
    expect(pieces[0]?.kind).toBe('narration');
  });
});

const KABAIR = `#META#Header#End#
### | الكبيرة الأولى الشرك بالله
# قال الله تعالى
~~ وقال النبي صلى الله عليه وسلم من مات لا يشرك بالله شيئا دخل الجنة ومن مات يشرك بالله شيئا دخل النار
### | فصل
# ليس كبيرة
`;

describe('parseKabairSections', () => {
  it('reads the kabira body and the prophet paragraph', () => {
    const pieces = parseKabairSections(KABAIR);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.number).toBe(1);
    expect(pieces[0]?.narrations).toHaveLength(1);
    expect(pieces[0]?.narrations[0]).toContain('لا يشرك بالله');
  });
});

const MINHAJ = `#META#Header#End#
### | 1 فصل [طلب العلم فريضة]
# قال رسول الله صلى الله عليه وسلم طلب العلم فريضة على كل مسلم وهذا النص يكفي ليعد رواية مستقلة في الفصل
~~ والعلم النافع هو ما أورث الخشية والعمل وهذا بيان المؤلف وليس رواية
`;

describe('parseMinhajSections', () => {
  it('reads a numbered الفصل and its narration', () => {
    const pieces = parseMinhajSections(MINHAJ);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.title).toContain('فصل');
    expect(pieces[0]?.narrations).toHaveLength(1);
  });
});
