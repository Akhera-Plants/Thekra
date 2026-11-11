/**
 * Review forms (round 8): what the member has typed in «محاسبة الأسبوع» / «محاسبة المساء» stays in memory while the
 * page is open, so an accidental close of the dialog never loses it. Cleared on save. Never written to disk or sent
 * anywhere: it is the member's private words.
 */
import { useCallback, useState } from 'react';

const drafts = new Map<string, unknown>();

export function useReviewDraft<T extends object>(key: string, initial: T): { draft: T; patch: (change: Partial<T>) => void; clear: () => void } {
  const [draft, setDraft] = useState<T>(() => ({ ...initial, ...((drafts.get(key) as Partial<T> | undefined) ?? {}) }));
  const patch = useCallback(
    (change: Partial<T>) =>
      setDraft((prev) => {
        const next = { ...prev, ...change };
        drafts.set(key, next);
        return next;
      }),
    [key],
  );
  const clear = useCallback(() => {
    drafts.delete(key);
  }, [key]);
  return { draft, patch, clear };
}
