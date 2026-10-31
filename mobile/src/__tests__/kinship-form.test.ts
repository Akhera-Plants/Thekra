/**
 * «أضف قريبًا» form: a nickname only. Phone numbers (Latin, Arabic-Indic or Persian digits), emails and
 * links are rejected through practice-core `looksLikeContactDetails`.
 */

import { emptyStore, updateRelative, upsertRelative } from '@thekra/practice-core';
import {
  formFromRelative,
  relativeEditFromForm,
  relativeFromForm,
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
  const existing = {
    ...(relativeFromForm(base, 'r1', '2026-10-01') as { ok: true; relative: import('@thekra/practice-core').Relative }).relative,
    history: ['2026-10-20'],
    lastContactedOn: '2026-10-20',
  };

  it('prefills the form from the relative', () => {
    expect(formFromRelative(existing)).toEqual(base);
    expect(formFromRelative({ ...existing, rule: { kind: 'everyNDays', n: 30, anchor: '2026-10-01' } }).rhythm).toBe('monthly');
    expect(formFromRelative({ ...existing, rule: { kind: 'everyNDays', n: 5, anchor: '2026-10-01' } })).toMatchObject({ rhythm: 'everyNDays', everyDays: 5 });
  });

  it('keeps the id, history and stored rule when only the name changes', () => {
    const res = relativeEditFromForm({ ...base, name: ' عمتي ' }, existing, '2026-10-28');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.relative).toMatchObject({ id: 'r1', name: 'عمتي', history: ['2026-10-20'] });
      expect(res.relative.rule).toEqual(existing.rule);
    }
  });

  it('a weekdays rule from another device survives an edit that leaves the rhythm alone', () => {
    const multi = { ...existing, rule: { kind: 'weekdays' as const, days: [1, 4] } };
    const res = relativeEditFromForm({ ...formFromRelative(multi), relation: 'عمة' }, multi, '2026-10-28');
    expect(res.ok && res.relative.rule).toEqual({ kind: 'weekdays', days: [1, 4] });
  });

  it('a changed rhythm gets a new rule anchored today; contact details are still rejected', () => {
    const res = relativeEditFromForm({ ...base, rhythm: 'monthly' }, existing, '2026-10-28');
    expect(res.ok && res.relative.rule).toEqual({ kind: 'everyNDays', n: 30, anchor: '2026-10-28' });
    expect(relativeEditFromForm({ ...base, name: '0501234567' }, existing, '2026-10-28')).toEqual({ ok: false, error: 'contactDetails' });
  });

  it('saved through practice-core updateRelative, the edit stamps updatedAt (so it syncs)', () => {
    const t0 = '2026-10-01T00:00:00.000Z';
    const t1 = '2026-10-28T10:00:00.000Z';
    const store = upsertRelative(emptyStore(), existing, t0);
    const res = relativeEditFromForm({ ...base, name: 'عمتي' }, store.relatives[0]!, '2026-10-28');
    if (!res.ok) throw new Error('expected ok');
    const next = updateRelative(store, 'r1', () => res.relative, t1);
    expect(next.relatives[0]).toMatchObject({ name: 'عمتي', updatedAt: t1, history: ['2026-10-20'] });
  });
});
