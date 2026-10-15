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

  it('stores the stronger grade and cites only the scholar who gave it', () => {
    const ruling = decideSunanRuling([
      hit({ rawGrade: 'Sahih' }),
      hit({ scholar: 'Bashar Awad Maarouf', book: 'tirmidhi', number: 4, rawGrade: 'Hasan Sahih' }),
    ]);
    expect(ruling?.grade).toBe(HadithGrade.SAHIH);
    expect(ruling?.gradeAuthority).toBe('شعيب الأرنؤوط');
    expect(ruling?.gradeReference).toBe('سنن أبي داود، رقم 1');
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
