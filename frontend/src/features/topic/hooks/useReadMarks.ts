'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { isQuoteId, markRead, readSet, setRead } from '@thekra/practice-core';
import { useSession } from '@/features/auth/hooks/useSession';
import { usePracticeStore } from '@/features/practice/hooks/usePracticeStore';
import { updateStore } from '@/lib/practice/local-store';

const noSubscribe = () => () => {};

export interface ReadMarks {
  /** Marks are shown and kept for a signed-in member only (they sync with the account, practice-core `reads.ts`). */
  enabled: boolean;
  isRead: (quoteId: string) => boolean;
  setRead: (quoteId: string, read: boolean) => void;
}

/**
 * «مقروء» / «غير مقروء» (owner chat, round 6 §8): the member's read marks on texts, kept in the device store and synced
 * with the account (practice-core `reads.ts`, last writer wins). Only Quote ids, never a text or a topic.
 */
export function useReadMarks(): ReadMarks {
  const { isAuthenticated, isLoading } = useSession();
  const snapshot = usePracticeStore();
  // Same as the server render until mounted (the session can resolve before hydration).
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const enabled = mounted && !isLoading && isAuthenticated && snapshot !== null;
  const read = useMemo(() => (snapshot ? readSet(snapshot.store) : new Set<string>()), [snapshot]);
  return {
    enabled,
    isRead: (quoteId) => read.has(quoteId.toLowerCase()),
    setRead: (quoteId, value) => {
      if (!isQuoteId(quoteId)) return;
      updateStore((store) => setRead(store, quoteId, value));
    },
  };
}

/** The reader marks its text read when it opens (member only; an unknown or malformed id is ignored). */
export function markReadOnOpen(quoteId: string): void {
  if (!isQuoteId(quoteId)) return;
  updateStore((store) => markRead(store, quoteId));
}
