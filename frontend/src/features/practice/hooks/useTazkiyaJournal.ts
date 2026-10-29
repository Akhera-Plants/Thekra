import { useSyncExternalStore } from 'react';
import type { TazkiyaJournal } from '@thekra/practice-core';
import { getJournalSnapshot, getServerJournalSnapshot, subscribeJournal } from '@/lib/practice/tazkiya-journal';

/** The private journal on this device, or null during the server render and hydration. */
export function useTazkiyaJournal(): TazkiyaJournal | null {
  return useSyncExternalStore(subscribeJournal, getJournalSnapshot, getServerJournalSnapshot);
}
