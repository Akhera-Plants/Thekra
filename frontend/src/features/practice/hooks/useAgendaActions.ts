import { useState } from 'react';
import {
  correctLog,
  logContact,
  logDone,
  removeContact,
  updatePlan,
  updateRelative,
  type HabitItem,
  type RelativeItem,
} from '@thekra/practice-core';
import { updateStore } from '@/lib/practice/local-store';

type LastAction =
  | { kind: 'habit'; planId: string; date: string; before: number; cleared: boolean }
  | { kind: 'relative'; relativeId: string; date: string; cleared: boolean };

/**
 * The hub's check controls: «تمّ» for a habit logs what is left of that day, «تواصلت» logs the contact; a second tap
 * takes it back (`correctLog` / `removeContact`, so the change also wins on the visitor's other devices). Every tick
 * and untick of this visit can be undone in one tap, so a stray tap never loses a logged amount.
 */
export function useAgendaActions() {
  const [last, setLast] = useState<LastAction | null>(null);

  function toggleHabit(item: HabitItem, date: string) {
    if (item.complete) {
      // Back to the amount before this visit's «تمّ»; without one, the day is cleared (0). Undo restores it.
      const before = last?.kind === 'habit' && last.planId === item.planId && last.date === date && !last.cleared ? last.before : 0;
      updateStore((store) => updatePlan(store, item.planId, (plan) => correctLog(plan, date, before)));
      setLast({ kind: 'habit', planId: item.planId, date, before: item.done, cleared: true });
      return;
    }
    updateStore((store) => updatePlan(store, item.planId, (plan) => logDone(plan, date, item.remaining)));
    setLast({ kind: 'habit', planId: item.planId, date, before: item.done, cleared: false });
  }

  function toggleRelative(item: RelativeItem, date: string) {
    if (item.done) {
      updateStore((store) => removeContact(store, item.relativeId, date));
      setLast({ kind: 'relative', relativeId: item.relativeId, date, cleared: true });
      return;
    }
    updateStore((store) => updateRelative(store, item.relativeId, (r) => logContact(r, date)));
    setLast({ kind: 'relative', relativeId: item.relativeId, date, cleared: false });
  }

  function undoLast() {
    if (!last) return;
    if (last.kind === 'habit') {
      updateStore((store) => updatePlan(store, last.planId, (plan) => correctLog(plan, last.date, last.before)));
    } else if (last.cleared) {
      updateStore((store) => updateRelative(store, last.relativeId, (r) => logContact(r, last.date)));
    } else {
      updateStore((store) => removeContact(store, last.relativeId, last.date));
    }
    setLast(null);
  }

  /** The row the inline undo belongs to: `habit:<planId>:<date>` or `relative:<id>:<date>`. */
  const lastKey = last ? `${last.kind}:${last.kind === 'habit' ? last.planId : last.relativeId}:${last.date}` : null;

  return { lastKey, lastCleared: last?.cleared ?? false, toggleHabit, toggleRelative, undoLast };
}
