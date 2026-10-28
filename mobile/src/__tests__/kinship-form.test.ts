/**
 * «أضف قريبًا» form: a nickname only. Phone numbers (Latin, Arabic-Indic or Persian digits), emails and
 * links are rejected through practice-core `looksLikeContactDetails`.
 */

import { relativeFromForm, validateRelativeForm, type RelativeFormValues } from '../lib/practice/kinship-form';

const base: RelativeFormValues = { name: 'خالتي', relation: 'خالة', rhythm: 'weekly', weekday: 5, everyDays: 10 };

describe('kinship form', () => {
  it('accepts a nickname', () => {
    expect(validateRelativeForm(base)).toBeNull();
    const res = relativeFromForm(base, 'r1', '2026-10-28');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.relative).toMatchObject({ id: 'r1', name: 'خالتي', relation: 'خالة', history: [] });
      expect(res.relative.rule).toEqual({ kind: 'everyNWeeks', n: 1, weekday: 5, anchor: '2026-10-28' });
    }
  });

  it.each([
    ['0599 123 456'],
    ['خالتي 0599123456'],
    ['٠٥٩٩١٢٣٤٥٦'],
    ['۰۹۱۲۳۴۵۶۷۸۹'],
    ['+970 (59) 912-3456'],
    ['aunt@example.com'],
    ['https://wa.me/970599123456'],
    ['www.example.com'],
  ])('rejects contact details in the name: %s', (name) => {
    expect(validateRelativeForm({ ...base, name })).toBe('contactDetails');
    expect(relativeFromForm({ ...base, name }, 'r1', '2026-10-28')).toEqual({ ok: false, error: 'contactDetails' });
  });

  it('rejects contact details in the relation field too', () => {
    expect(validateRelativeForm({ ...base, relation: 't.me/aunt' })).toBe('contactDetails');
  });

  it('requires a name and keeps short numbers (e.g. «عمي 2») allowed', () => {
    expect(validateRelativeForm({ ...base, name: '   ' })).toBe('nameRequired');
    expect(validateRelativeForm({ ...base, name: 'x'.repeat(61) })).toBe('nameTooLong');
    expect(validateRelativeForm({ ...base, name: 'عمي 2' })).toBeNull();
  });

  it('maps the rhythm choices to practice-core kinship rules', () => {
    const r = (rhythm: RelativeFormValues['rhythm'], everyDays = 10) =>
      relativeFromForm({ ...base, rhythm, everyDays }, 'r', '2026-10-28');
    expect(r('biweekly')).toMatchObject({ ok: true, relative: { rule: { kind: 'everyNWeeks', n: 2 } } });
    expect(r('monthly')).toMatchObject({ ok: true, relative: { rule: { kind: 'everyNDays', n: 30 } } });
    expect(r('everyNDays', 14)).toMatchObject({ ok: true, relative: { rule: { kind: 'everyNDays', n: 14 } } });
    expect(r('everyNDays', 0)).toEqual({ ok: false, error: 'invalidRhythm' });
  });
});
