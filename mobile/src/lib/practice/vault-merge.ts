/**
 * Merging the sin programs of this device with the ones opened from the vault (another device): practice-core
 * `mergePrograms`, the same rules as the web (later check-in per date wins; an end is not undone by an older copy).
 */

import { mergePrograms as mergeCore, parsePrograms, type SinProgram } from '@thekra/practice-core';

export function mergePrograms(local: readonly SinProgram[], remote: readonly SinProgram[]): SinProgram[] {
  return parsePrograms(mergeCore(local, remote));
}

/** True when both lists hold the same programs (order-insensitive by sin). */
export function sameJsonPrograms(a: readonly SinProgram[], b: readonly SinProgram[]): boolean {
  const key = (list: readonly SinProgram[]) => JSON.stringify(parsePrograms([...list].sort((x, y) => (x.sinSlug < y.sinSlug ? -1 : 1))));
  return key(a) === key(b);
}
