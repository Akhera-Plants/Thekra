import { describe, expect, it } from 'vitest';
import { formatGradeCitation } from './grade-citation';

describe('formatGradeCitation', () => {
  it('puts the Sunan book and number before the Arnaut grader (en)', () => {
    expect(
      formatGradeCitation({
        locale: 'en',
        gradeAuthority: 'شعيب الأرنؤوط',
        gradeReference: 'سنن أبي داود، رقم 5186',
        grade: 'SAHIH',
      }),
    ).toBe("Sunan Abi Dawud 5186 · graded sahih by Shu'ayb al-Arna'ut");
  });

  it('puts the Sunan book and number before the Arnaut grader (ar)', () => {
    expect(
      formatGradeCitation({
        locale: 'ar',
        gradeAuthority: 'شعيب الأرنؤوط',
        gradeReference: 'سنن أبي داود، رقم 5186',
        grade: 'SAHIH',
      }),
    ).toBe('سنن أبي داود، رقم 5186 · صحّحه شعيب الأرنؤوط');
  });

  it('keeps Sahihayn short form', () => {
    expect(
      formatGradeCitation({
        locale: 'en',
        gradeAuthority: 'رواه مسلم',
        gradeReference: 'مسلم 35',
      }),
    ).toBe('Narrated by Muslim, no. 35');
  });

  it('never presents the grader as the book', () => {
    const line = formatGradeCitation({
      locale: 'en',
      gradeAuthority: 'شعيب الأرنؤوط',
      gradeReference: 'سنن ابن ماجه، رقم 3942',
      grade: 'SAHIH',
    });
    expect(line?.startsWith("Shu'ayb")).toBe(false);
    expect(line).toMatch(/^Sunan Ibn Majah 3942/);
  });

  it('names a hasan grade by the grader that gave it', () => {
    expect(
      formatGradeCitation({
        locale: 'en',
        gradeAuthority: 'شعيب الأرنؤوط',
        gradeReference: 'سنن أبي داود، رقم 5186',
        grade: 'HASAN',
      }),
    ).toBe("Sunan Abi Dawud 5186 · graded hasan by Shu'ayb al-Arna'ut");
  });

  it('formats a HadeethEnc citation line (ar)', () => {
    expect(
      formatGradeCitation({
        locale: 'ar',
        gradeAuthority: 'موسوعة الأحاديث النبوية',
        gradeReference: 'صحيح مسلم (1/ 545) (791).',
        grade: 'SAHIH',
      }),
    ).toBe('حكم موسوعة الأحاديث النبوية: صحيح — صحيح مسلم (1/ 545) (791).');
  });

  it('formats a HadeethEnc citation line (en)', () => {
    expect(
      formatGradeCitation({
        locale: 'en',
        gradeAuthority: 'موسوعة الأحاديث النبوية',
        gradeReference: 'Sahih Muslim 791',
        grade: 'HASAN',
      }),
    ).toBe('Hadeeth Encyclopedia ruling: Good — Sahih Muslim 791');
  });

  it('drops an untranslated Arabic edition note from the English line', () => {
    expect(
      formatGradeCitation({
        locale: 'en',
        gradeAuthority: 'موسوعة الأحاديث النبوية',
        gradeReference: 'صحيح البخاري، نشر: دار طوق النجاة، الطبعة: الأولى، 1422ه.',
        grade: 'SAHIH',
      }),
    ).toBe('Hadeeth Encyclopedia ruling: Authentic');
  });
});

describe('formatGradeCitation — Musnad Ahmad and Ibn Hibban (Arna\'ut tahqiq)', () => {
  it('cites the book and number first, then the grader, in both languages', () => {
    const input = {
      gradeAuthority: 'شعيب الأرنؤوط',
      gradeReference: 'مسند أحمد (ط. قرطبة)، رقم 10519، صحيح ابن حبان، رقم 609',
      grade: 'SAHIH',
    };
    expect(formatGradeCitation({ ...input, locale: 'ar' })).toBe(
      'مسند أحمد (ط. قرطبة)، رقم 10519، صحيح ابن حبان، رقم 609 · صحّحه شعيب الأرنؤوط',
    );
    expect(formatGradeCitation({ ...input, locale: 'en' })).toBe(
      "Musnad Ahmad (Qurtuba ed.) 10519, Sahih Ibn Hibban 609 · graded sahih by Shu'ayb al-Arna'ut",
    );
  });
});

describe('formatGradeCitation beside the source badge (round 7, B4)', () => {
  const badge = 'صحيح البخاري، رقم 2595';
  it('drops «رواه البخاري، رقم 2595» when the badge names the same book and number', () => {
    expect(formatGradeCitation({ locale: 'ar', gradeAuthority: 'رواه البخاري', gradeReference: 'البخاري 2595', besideSource: badge })).toBeNull();
    expect(formatGradeCitation({ locale: 'en', gradeAuthority: 'رواه البخاري', gradeReference: 'البخاري 2595', besideSource: badge })).toBeNull();
  });
  it('keeps the line when the badge is another book', () => {
    expect(
      formatGradeCitation({ locale: 'ar', gradeAuthority: 'رواه مسلم', gradeReference: 'مسلم 253', besideSource: 'رياض الصالحين، رقم 1200' }),
    ).toBe('رواه مسلم، رقم 253');
  });
  it('keeps only the grader when the badge already names the Sunan book and number', () => {
    const input = { gradeAuthority: 'شعيب الأرنؤوط', gradeReference: 'سنن أبي داود، رقم 5186', grade: 'SAHIH', besideSource: 'سنن ابي داود، رقم 5186' };
    expect(formatGradeCitation({ locale: 'ar', ...input })).toBe('صحّحه شعيب الأرنؤوط');
    expect(formatGradeCitation({ locale: 'en', ...input })).toBe("Graded sahih by Shu'ayb al-Arna'ut");
  });
  it('keeps «متفق عليه» (it adds the second book)', () => {
    expect(
      formatGradeCitation({ locale: 'ar', gradeAuthority: 'متفق عليه', gradeReference: 'البخاري 1038، مسلم 71', besideSource: 'صحيح البخاري، رقم 1038' }),
    ).toBe('متفق عليه، البخاري 1038، مسلم 71');
  });
});
