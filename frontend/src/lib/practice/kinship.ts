/**
 * صلة الرحم helpers for the page: rhythm presets ↔ practice-core rules, and the calendar export.
 * Calendar titles are generic («صلة رحم») unless the user turned names on (roadmap §0.2, §2.4).
 */
import {
  addDays,
  isValidDate,
  maxDate,
  nextDue,
  nowIso,
  occurrencesToEvents,
  validateRelative,
  type IcsEvent,
  type IsoTime,
  type KinshipRule,
  type LocalDate,
  type Relative,
} from '@thekra/practice-core';

export const RHYTHMS = ['weekly', 'biweekly', 'monthly'] as const;
export type Rhythm = (typeof RHYTHMS)[number];
/** Friday: the habit catalog's default day for kinship. */
export const DEFAULT_WEEKDAY = 5;
export const MONTH_RHYTHM_DAYS = 30;
export const KINSHIP_EXPORT_DAYS = 90;

export function rhythmRule(rhythm: Rhythm, weekday: number, today: LocalDate): KinshipRule {
  if (rhythm === 'monthly') return { kind: 'everyNDays', n: MONTH_RHYTHM_DAYS, anchor: today };
  return { kind: 'everyNWeeks', n: rhythm === 'weekly' ? 1 : 2, weekday, anchor: today };
}

/** The preset a rule was made from, for its label; null for a rule made elsewhere (e.g. another app). */
export function rhythmOf(rule: KinshipRule): { rhythm: Rhythm; weekday: number | null } | null {
  if (rule.kind === 'everyNDays' && rule.n === MONTH_RHYTHM_DAYS) return { rhythm: 'monthly', weekday: null };
  if (rule.kind === 'everyNWeeks' && (rule.n === 1 || rule.n === 2)) {
    return { rhythm: rule.n === 1 ? 'weekly' : 'biweekly', weekday: rule.weekday };
  }
  return null;
}

/** «تعديل» on a relative: the form's values. `custom` keeps a rule made elsewhere (no preset matches it). */
export interface RelativeEdit {
  name: string;
  relation: string;
  rhythm: Rhythm | 'custom';
  weekday: number;
}

/**
 * Applies an edit: name, relation and rhythm. An unchanged rhythm keeps the stored rule (and its anchor); a new one
 * starts from `today`. Contacts are kept. `updatedAt` becomes `now` when something changed, so the edit syncs.
 * Throws when the result is invalid (e.g. contact details in the name).
 */
export function editRelative(relative: Relative, edit: RelativeEdit, today: LocalDate, now: IsoTime = nowIso()): Relative {
  const preset = rhythmOf(relative.rule);
  const sameRhythm =
    edit.rhythm === 'custom' ||
    (preset !== null &&
      preset.rhythm === edit.rhythm &&
      (edit.rhythm === 'monthly' || preset.weekday === edit.weekday));
  const rule = sameRhythm ? relative.rule : rhythmRule(edit.rhythm as Rhythm, edit.weekday, today);
  const name = edit.name.trim();
  const relation = edit.relation.trim();
  if (sameRhythm && name === relative.name && relation === relative.relation) return relative;
  const next: Relative = { ...relative, name, relation, rule, updatedAt: now };
  const err = validateRelative(next);
  if (err) throw new RangeError(`Invalid relative: ${err}`);
  return next;
}

/**
 * The next {@link KINSHIP_EXPORT_DAYS} days of reminders per relative, starting at the next due date (or
 * today when overdue). Timed at 18:00 local with an alarm at the start.
 */
export function kinshipEvents(
  relatives: readonly Relative[],
  today: LocalDate,
  title: (relative: Relative) => string,
): IcsEvent[] {
  if (!isValidDate(today)) throw new RangeError('Invalid today');
  const to = addDays(today, KINSHIP_EXPORT_DAYS - 1);
  const events: IcsEvent[] = [];
  for (const relative of relatives) {
    const start = maxDate(nextDue(relative, today), today);
    const rule = relative.rule;
    const anchored: KinshipRule = rule.kind === 'weekdays' ? rule : { ...rule, anchor: start };
    events.push(
      ...occurrencesToEvents(anchored, start, to, {
        uidPrefix: `relative-${relative.id}`,
        title: title(relative),
        time: '18:00',
        durationMinutes: 15,
        alarmMinutesBefore: 0,
      }),
    );
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
