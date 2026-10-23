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
