/**
 * Merging the sin programs of this device with the ones opened from the vault (another device). Pure.
 * Union by sin; for the same sin the check-ins are a union by date and this device wins on the same date
 * (its entry is the latest the user saw here). Other fields come from this device when it has the program.
 */

import { parsePrograms, type CheckIn, type SinProgram } from '@thekra/practice-core';

export function mergePrograms(local: readonly SinProgram[], remote: readonly SinProgram[]): SinProgram[] {
  const out = local.map((p) => ({ ...p, checkIns: [...p.checkIns] }));
  for (const r of remote) {
    const l = out.find((p) => p.sinSlug === r.sinSlug);
    if (!l) {
      out.push({ ...r, checkIns: [...r.checkIns] });
      continue;
    }
    const byDate = new Map<string, CheckIn>(r.checkIns.map((c) => [c.date, c]));
    for (const c of l.checkIns) byDate.set(c.date, c);
    l.checkIns = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (r.startedOn < l.startedOn) l.startedOn = r.startedOn;
  }
  return parsePrograms(out);
}

/** True when both lists hold the same programs (order-insensitive by sin). */
export function sameJsonPrograms(a: readonly SinProgram[], b: readonly SinProgram[]): boolean {
  const key = (list: readonly SinProgram[]) => JSON.stringify(parsePrograms([...list].sort((x, y) => (x.sinSlug < y.sinSlug ? -1 : 1))));
  return key(a) === key(b);
}
