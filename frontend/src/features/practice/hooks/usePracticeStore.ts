import { useSyncExternalStore } from 'react';
import {
  getPracticeSnapshot,
  getServerPracticeSnapshot,
  subscribePractice,
  type PracticeSnapshot,
} from '@/lib/practice/local-store';

/** The device store, or null during the server render and hydration (no device data there). */
export function usePracticeStore(): PracticeSnapshot | null {
  return useSyncExternalStore(subscribePractice, getPracticeSnapshot, getServerPracticeSnapshot);
}
