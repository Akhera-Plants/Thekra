import { useSyncExternalStore } from 'react';
import type { HeartData } from '@thekra/practice-core';
import { getHeartSnapshot, getServerHeartSnapshot, subscribeHeart } from '@/lib/practice/heart-store';

/** «المقامات» data of this browser, or null during the server render. */
export function useHeart(): HeartData | null {
  return useSyncExternalStore(subscribeHeart, getHeartSnapshot, getServerHeartSnapshot);
}
