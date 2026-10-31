/**
 * Validation of the relative form («أضف قريبًا» and its edit). A relative is a nickname and a rhythm, never a phone number, an
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

/** Monthly is saved as every 30 days (`rhythmToRule`). */
const MONTH_DAYS = 30;
/** The «عدد أيام» choice the form starts on when the rhythm is not a day count. */
const DEFAULT_EVERY_DAYS = 10;

/** The form's rhythm for a saved rule (a `weekdays` rule from another device opens as weekly on its first day). */
export function ruleToFormValues(rule: KinshipRule, fallbackWeekday: number): Pick<RelativeFormValues, 'rhythm' | 'weekday' | 'everyDays'> {
  switch (rule.kind) {
    case 'everyNWeeks':
      return { rhythm: rule.n === 2 ? 'biweekly' : 'weekly', weekday: rule.weekday, everyDays: DEFAULT_EVERY_DAYS };
    case 'everyNDays':
      return rule.n === MONTH_DAYS
        ? { rhythm: 'monthly', weekday: fallbackWeekday, everyDays: DEFAULT_EVERY_DAYS }
        : { rhythm: 'everyNDays', weekday: fallbackWeekday, everyDays: rule.n };
    case 'weekdays':
      return { rhythm: 'weekly', weekday: rule.days[0] ?? fallbackWeekday, everyDays: DEFAULT_EVERY_DAYS };
  }
}

/** The form values of a saved relative (the edit form opens on them). */
export function relativeToFormValues(relative: Relative, fallbackWeekday: number): RelativeFormValues {
  return { name: relative.name, relation: relative.relation, ...ruleToFormValues(relative.rule, fallbackWeekday) };
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
 * The relative after the edit form, or the form error. An unchanged rhythm keeps the saved rule (and its anchor), so
 * renaming someone does not move their next due date. Contacts and history stay as they are. Never throws.
 */
export function editedRelative(
  existing: Relative,
  values: RelativeFormValues,
  today: LocalDate,
): { ok: true; relative: Relative } | { ok: false; error: RelativeFormError } {
  const error = validateRelativeForm(values);
  if (error) return { ok: false, error };
  const saved = ruleToFormValues(existing.rule, values.weekday);
  const sameRhythm =
    saved.rhythm === values.rhythm &&
    (values.rhythm === 'monthly' ||
      (values.rhythm === 'everyNDays' ? saved.everyDays === values.everyDays : saved.weekday === values.weekday));
  return {
    ok: true,
    relative: {
      ...existing,
      name: values.name.trim(),
      relation: values.relation.trim(),
      rule: sameRhythm ? existing.rule : rhythmToRule(values, today),
    },
  };
}
