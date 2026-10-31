/**
 * Posts «حضرت اليوم» to the user's circles when today's practice store first holds a log (a habit amount or a
 * contact), and clears it when the last one of the day is undone. Best effort: a failure is dropped and retried on the
 * next change. The server marks only the circles where the user turned sharing on, so the app needs no circle list.
 * Mounted by the «عاداتي» hub and the plan screen; the module-level map keeps the two from posting twice.
 */

import { useEffect } from 'react';
import { clearPresence, markPresence } from '../api/circles';
import { today, usePracticeStore } from '../practice/practice-store';
import { useAuthStore } from '../stores/auth-store';
import { loggedOn } from './circle-view';

/** `${userId}|${date}` → the state last sent (or in flight). */
const sent = new Map<string, boolean>();

export function useCirclePresence(): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const date = today();
  const isLogged = usePracticeStore((s) => s.hydrated && loggedOn(s.store, date));

  useEffect(() => {
    if (!userId) return;
    const key = `${userId}|${date}`;
    const last = sent.get(key);
    // Nothing logged and nothing sent this session: there is no mark to clear.
    if (last === isLogged || (last === undefined && !isLogged)) return;
    sent.set(key, isLogged);
    (isLogged ? markPresence(date) : clearPresence(date)).catch(() => {
      if (sent.get(key) === isLogged) sent.delete(key);
    });
  }, [userId, date, isLogged]);
}
