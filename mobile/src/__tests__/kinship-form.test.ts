/**
 * «أضف قريبًا» form: a nickname only. Phone numbers (Latin, Arabic-Indic or Persian digits), emails and
 * links are rejected through practice-core `looksLikeContactDetails`.
 */

import { emptyStore, updateRelative, upsertRelative } from '@thekra/practice-core';
import {
  editedRelative,
  relativeFromForm,
  relativeToFormValues,
  validateRelativeForm,
  type RelativeFormValues,
} from '../lib/practice/kinship-form';

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

describe('kinship edit form', () => {
  const saved = (() => {
    const res = relativeFromForm(base, 'r1', '2026-10-01');
    if (!res.ok) throw new Error('fixture');
    return { ...res.relative, history: ['2026-10-10'], lastContactedOn: '2026-10-10' };
  })();

  it('opens on the saved values', () => {
    expect(relativeToFormValues(saved, 0)).toEqual(base);
    const monthly = { ...saved, rule: { kind: 'everyNDays' as const, n: 30, anchor: '2026-10-01' } };
    expect(relativeToFormValues(monthly, 5)).toMatchObject({ rhythm: 'monthly', weekday: 5 });
    const weekdays = { ...saved, rule: { kind: 'weekdays' as const, days: [2, 4] } };
    expect(relativeToFormValues(weekdays, 5)).toMatchObject({ rhythm: 'weekly', weekday: 2 });
  });

  it('renames without moving the rhythm or losing contacts', () => {
    const res = editedRelative(saved, { ...base, name: ' عمّي ' }, '2026-10-28');
    expect(res).toMatchObject({ ok: true, relative: { id: 'r1', name: 'عمّي', rule: saved.rule, history: ['2026-10-10'] } });
  });

  it('starts a new rhythm from today when it changes', () => {
    const res = editedRelative(saved, { ...base, rhythm: 'everyNDays', everyDays: 14 }, '2026-10-28');
    expect(res).toMatchObject({ ok: true, relative: { rule: { kind: 'everyNDays', n: 14, anchor: '2026-10-28' } } });
  });

  it('rejects contact details like the add form', () => {
    expect(editedRelative(saved, { ...base, name: '0599 123 456' }, '2026-10-28')).toEqual({ ok: false, error: 'contactDetails' });
  });

  it('a weekdays rule from another device survives an edit that leaves the rhythm alone', () => {
    const multi = { ...saved, rule: { kind: 'weekdays' as const, days: [1, 4] } };
    const res = editedRelative(multi, { ...relativeToFormValues(multi, 5), relation: 'عمة' }, '2026-10-28');
    expect(res.ok && res.relative.rule).toEqual({ kind: 'weekdays', days: [1, 4] });
  });

  it('saved through practice-core updateRelative, the edit stamps updatedAt (so it syncs)', () => {
    const t0 = '2026-10-01T00:00:00.000Z';
    const t1 = '2026-10-28T10:00:00.000Z';
    const store = upsertRelative(emptyStore(), saved, t0);
    const res = editedRelative(store.relatives[0]!, { ...base, name: 'عمتي' }, '2026-10-28');
    if (!res.ok) throw new Error('expected ok');
    const next = updateRelative(store, 'r1', () => res.relative, t1);
    expect(next.relatives[0]).toMatchObject({ name: 'عمتي', updatedAt: t1, history: ['2026-10-10'] });
  });
});
