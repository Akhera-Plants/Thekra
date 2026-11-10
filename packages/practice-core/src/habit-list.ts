/**
 * «العادات» with the «تخفّف» programs (owner round 6, C-02e; docs/plan/2026-11-09-owner-round-6.md §2): the programs
 * appear as habits of type «تخفّف» beside the habits to build. They are COVERED by default: a neutral row with no sin
 * name; tapping asks the fingerprint / PIN (app) or the privacy code (web) before any detail shows. The member may turn
 * the covering off (`settings.lightenCovered = false`, synced). Never blurred text. Encryption is unchanged: the program
 * itself stays in the vault and in device memory; only the switch syncs.
 *
 * When the programs are locked (not in memory) the list holds one covered «تخفّف» row with no count. Pure.
 */
import { nowIso, type IsoTime, type LocalDate } from './dates.js';
import { isPaused, type Plan } from './plan.js';
import { withCustomPeriodic } from './periodic.js';
import { activePrograms, type SinProgram } from './sin-program.js';
import { updateSettings, type Store } from './storage.js';

/** True when «تخفّف» rows are covered (the default). */
export function isLightenCovered(store: Pick<Store, 'settings'>): boolean {
  return store.settings.lightenCovered !== false;
}

/** Turns the covering on (default, stored as absent) or off. */
export function setLightenCovered(store: Store, covered: boolean, now: IsoTime = nowIso()): Store {
  return updateSettings(store, { lightenCovered: covered ? undefined : false }, now);
}

export type HabitListRow =
  /** A habit to build («بناء»). */
  | { kind: 'habit'; plan: Plan }
  /**
   * A «تخفّف» program shown as a habit. `program` is null while locked (one generic row). When `covered`, the client
   * shows a neutral row and asks for unlocking before rendering anything from `program`.
   */
  | { kind: 'lighten'; covered: boolean; locked: boolean; program: SinProgram | null; startedOn: LocalDate | null };

export interface HabitListOptions {
  isPeriodicAct?: (plan: Plan) => boolean;
  /**
   * Round 7 (C6): false while the member has no «رمز الخصوصية» (the programs stay on this device, unencrypted, and
   * there is nothing to unlock): the rows show like any habit. Default: the setting ({@link isLightenCovered}).
   */
  covered?: boolean;
}

/**
 * The rows of «العادات»: live habits (not archived, not periodic) in the store's order, then the «تخفّف» programs
 * (oldest first). `programs`: the unlocked programs, or null when locked (then one covered row if `hasPrograms`).
 */
export function habitListRows(
  store: Pick<Store, 'plans' | 'settings'>,
  programs: readonly SinProgram[] | null,
  opts: HabitListOptions & { hasPrograms?: boolean } = {},
): HabitListRow[] {
  const periodic = withCustomPeriodic(opts.isPeriodicAct);
  const rows: HabitListRow[] = store.plans.filter((p) => !isPaused(p) && !periodic(p)).map((plan) => ({ kind: 'habit' as const, plan }));
  if (programs === null) {
    if (opts.hasPrograms) rows.push({ kind: 'lighten', covered: true, locked: true, program: null, startedOn: null });
    return rows;
  }
  const covered = opts.covered ?? isLightenCovered(store);
  for (const program of [...activePrograms(programs)].sort((a, b) => (a.startedOn < b.startedOn ? -1 : 1))) {
    rows.push({ kind: 'lighten', covered, locked: false, program, startedOn: program.startedOn });
  }
  return rows;
}
