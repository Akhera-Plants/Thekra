/**
 * Validation of the «أضف قريبًا» form. A relative is a nickname and a rhythm, never a phone number, an
 * email or a link (practice-core `looksLikeContactDetails`, silat-rahim-plan §4). Pure, for Jest.
 */

import {
  MAX_NAME_LENGTH,
  createRelative,
  looksLikeContactDetails,
  type KinshipRule,
  type LocalDate,
  type Relative,
} from '@thekra/practice-core';

export type RhythmChoice = 'weekly' | 'biweekly' | 'monthly' | 'everyNDays';

export interface RelativeFormValues {
  name: string;
  relation: string;
  rhythm: RhythmChoice;
  /** Weekday for weekly/biweekly (0 = Sunday). */
  weekday: number;
  /** For everyNDays. */
  everyDays: number;
}

/** i18n keys under `kinship.errors.*`. */
export type RelativeFormError = 'nameRequired' | 'nameTooLong' | 'contactDetails' | 'invalidRhythm';

export function rhythmToRule(values: Pick<RelativeFormValues, 'rhythm' | 'weekday' | 'everyDays'>, today: LocalDate): KinshipRule {
  switch (values.rhythm) {
    case 'weekly':
      return { kind: 'everyNWeeks', n: 1, weekday: values.weekday, anchor: today };
    case 'biweekly':
      return { kind: 'everyNWeeks', n: 2, weekday: values.weekday, anchor: today };
    case 'monthly':
      return { kind: 'everyNDays', n: 30, anchor: today };
    case 'everyNDays':
      return { kind: 'everyNDays', n: values.everyDays, anchor: today };
  }
}

export function validateRelativeForm(values: RelativeFormValues): RelativeFormError | null {
  const name = values.name.trim();
  if (name.length === 0) return 'nameRequired';
  if (name.length > MAX_NAME_LENGTH) return 'nameTooLong';
  if (looksLikeContactDetails(name) || looksLikeContactDetails(values.relation)) return 'contactDetails';
  if (values.rhythm === 'everyNDays' && !(Number.isInteger(values.everyDays) && values.everyDays >= 1 && values.everyDays <= 365)) {
    return 'invalidRhythm';
  }
  if ((values.rhythm === 'weekly' || values.rhythm === 'biweekly') && !(Number.isInteger(values.weekday) && values.weekday >= 0 && values.weekday <= 6)) {
    return 'invalidRhythm';
  }
  return null;
}

/** The new relative, or the form error. Never throws. */
export function relativeFromForm(
  values: RelativeFormValues,
  id: string,
  today: LocalDate,
): { ok: true; relative: Relative } | { ok: false; error: RelativeFormError } {
  const error = validateRelativeForm(values);
  if (error) return { ok: false, error };
  try {
    return {
      ok: true,
      relative: createRelative({ id, name: values.name.trim(), relation: values.relation.trim(), rule: rhythmToRule(values, today) }),
    };
  } catch {
    return { ok: false, error: 'invalidRhythm' };
  }
}

/**
 * The form values for editing an existing relative. A rule the form cannot show exactly (a weekdays rule from
 * another device, every 3+ weeks) is shown as its nearest choice; {@link relativeEditFromForm} keeps the stored
 * rule unless the user changes the rhythm.
 */
export function formFromRelative(rel: Relative): RelativeFormValues {
  const base = { name: rel.name, relation: rel.relation, weekday: 5, everyDays: 10 };
  const rule = rel.rule;
  switch (rule.kind) {
    case 'everyNWeeks':
      return { ...base, rhythm: rule.n === 2 ? 'biweekly' : 'weekly', weekday: rule.weekday };
    case 'everyNDays':
      return rule.n === 30 ? { ...base, rhythm: 'monthly' } : { ...base, rhythm: 'everyNDays', everyDays: rule.n };
    case 'weekdays':
      return { ...base, rhythm: 'weekly', weekday: rule.days[0] ?? 5 };
  }
}

function sameRhythm(a: RelativeFormValues, b: RelativeFormValues): boolean {
  if (a.rhythm !== b.rhythm) return false;
  if (a.rhythm === 'weekly' || a.rhythm === 'biweekly') return a.weekday === b.weekday;
  if (a.rhythm === 'everyNDays') return a.everyDays === b.everyDays;
  return true;
}

/**
 * The edited relative (same id, history and contacts), or the form error. Name and relation are taken from the
 * form; the rule changes only when the rhythm was changed (then anchored on `today`). Save it with practice-core
 * `updateRelative`, which stamps `updatedAt` so the edit syncs. Never throws.
 */
export function relativeEditFromForm(
  values: RelativeFormValues,
  existing: Relative,
  today: LocalDate,
): { ok: true; relative: Relative } | { ok: false; error: RelativeFormError } {
  const error = validateRelativeForm(values);
  if (error) return { ok: false, error };
  const rule = sameRhythm(values, formFromRelative(existing)) ? existing.rule : rhythmToRule(values, today);
  return { ok: true, relative: { ...existing, name: values.name.trim(), relation: values.relation.trim(), rule } };
}
