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
    ).toBe("Sunan Abi Dawud 5186 — graded sahih by Shu'ayb al-Arna'ut");
  });

  it('puts the Sunan book and number before the Arnaut grader (ar)', () => {
    expect(
      formatGradeCitation({
        locale: 'ar',
        gradeAuthority: 'شعيب الأرنؤوط',
        gradeReference: 'سنن أبي داود، رقم 5186',
        grade: 'SAHIH',
      }),
    ).toBe('سنن أبي داود، رقم 5186 — صحّحه شعيب الأرنؤوط');
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
});
