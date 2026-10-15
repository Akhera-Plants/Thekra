import { HadithGrade } from '@prisma/client';
import { appropriateGrade, citesSahihayn, decideSunanRuling, type SunanHit } from './sunan-tahqiq.js';

function hit(partial: Partial<SunanHit> & Pick<SunanHit, 'rawGrade'>): SunanHit {
  return {
    scholar: 'Shuaib Al Arnaut',
    book: 'abudawud',
    number: 1,
    ...partial,
  };
}

describe('appropriateGrade', () => {
  it('accepts sahih and hasan labels, including sahih by supporting chains and Tirmidhi’s hasan sahih', () => {
    expect(appropriateGrade('Sahih')).toBe(HadithGrade.SAHIH);
    expect(appropriateGrade('Sahih Lighairihi')).toBe(HadithGrade.SAHIH);
    expect(appropriateGrade('Hasan')).toBe(HadithGrade.HASAN);
    expect(appropriateGrade('Hasan Sahih')).toBe(HadithGrade.HASAN);
    expect(appropriateGrade('Hasan Lighairihi')).toBe(HadithGrade.HASAN);
  });

  it('refuses weak, fabricated, mawquf, and isnad-only labels', () => {
    for (const raw of ['Daif', 'Very Daif', 'Sanad Daif', 'Mawdu', 'Batil', 'Shadh', 'Munkar', 'Mauquf', 'Sahih Muquf', 'Sahih Maqtu', 'Hasan Maqtu', 'Maqtu']) {
      expect(appropriateGrade(raw)).toBeNull();
    }
  });
});

describe('citesSahihayn', () => {
  it('recognises the author’s placement in the two Sahihs', () => {
    expect(citesSahihayn('«تطعم الطعام». متفق عليه.')).toBe(true);
    expect(citesSahihayn('بالسواك. رواه مسلم.')).toBe(true);
    expect(citesSahihayn('رواه البخاري.')).toBe(true);
    expect(citesSahihayn('من كان آخر كلامه لا إله إلا الله دخل الجنة')).toBe(false);
  });

  it('recognises وفى/وفي/في with optional quotes and خرجه / خرّجاه forms', () => {
    expect(citesSahihayn('وفى "الصحيحين" عن ابن عمر… إن أحدكم إذا مات عرض عليه…')).toBe(true);
    expect(citesSahihayn('وفي «الصحيحين» عن أبي هريرة')).toBe(true);
    expect(citesSahihayn('في الصحيحين')).toBe(true);
    expect(citesSahihayn('خرجه البخاري في كتاب الجنائز')).toBe(true);
    expect(citesSahihayn('خرجه مسلم')).toBe(true);
    expect(citesSahihayn('خرّجاه')).toBe(true);
    expect(citesSahihayn('أخرجه البخاري')).toBe(true);
    expect(citesSahihayn('أخرجه مسلم')).toBe(true);
  });
});

describe('decideSunanRuling', () => {
  it('names Arnaut and cites Abu Dawud when his grade is sahih', () => {
    expect(decideSunanRuling([hit({ rawGrade: 'Sahih', number: 12 })])).toEqual({
      grade: HadithGrade.SAHIH,
      gradeAuthority: 'شعيب الأرنؤوط',
      gradeReference: 'سنن أبي داود، رقم 12',
      scholars: ['شعيب الأرنؤوط'],
      references: ['سنن أبي داود، رقم 12'],
      rawGrades: ['Sahih'],
    });
  });

  it('lists only Arnaut as a Sunan scholar key', async () => {
    const { SUNAN_SCHOLAR_NAMES } = await import('./sunan-tahqiq.js');
    expect(Object.keys(SUNAN_SCHOLAR_NAMES)).toEqual(['Shuaib Al Arnaut']);
  });

  it('keeps a sahih hit when a close narration is daif, and still refuses a mawquf on its own', () => {
    const ruling = decideSunanRuling([
      hit({ rawGrade: 'Sahih' }),
      hit({ book: 'ibnmajah', number: 9, rawGrade: 'Daif' }),
    ]);
    expect(ruling?.grade).toBe(HadithGrade.SAHIH);
    expect(ruling?.gradeReference).toBe('سنن أبي داود، رقم 1');
    expect(decideSunanRuling([hit({ rawGrade: 'Sahih Muquf' })])).toBeNull();
    expect(decideSunanRuling([hit({ rawGrade: 'Daif' })])).toBeNull();
    expect(decideSunanRuling([])).toBeNull();
  });
});
