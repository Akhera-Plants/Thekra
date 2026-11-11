/**
 * Review forms (round 8): what the member has typed in «محاسبة الأسبوع» / «محاسبة المساء» stays in memory while the app
 * runs, so closing the sheet by accident never loses it. Cleared on save. Never written to disk or sent anywhere: it is
 * the member's private words.
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

/** The text with `answer` added after it (once), cut at `max`. */
export function withAnswer(value: string, answer: string, max: number): string {
  if (value.includes(answer)) return value;
  const joined = value.trim().length > 0 ? `${value.trim()}، ${answer}` : answer;
  return joined.slice(0, max);
}
