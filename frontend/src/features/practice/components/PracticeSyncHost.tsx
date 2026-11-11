'use client';

import { usePracticeSyncRunner } from '../hooks/usePracticeSync';

/** Runs the practice sync for the signed-in account on every page. Renders nothing. */
export function PracticeSyncHost() {
  usePracticeSyncRunner();
  return null;
}
