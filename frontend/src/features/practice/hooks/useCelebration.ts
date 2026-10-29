import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { celebrationLine } from '@thekra/practice-core';
import { usePracticeCatalog } from './usePracticeCatalog';

/** How long the supplication stays after a tick. */
const CELEBRATION_MS = 2000;

/** The lines take turns across the page; the first one differs from visit to visit. */
let turn = Math.floor(Math.random() * 1000);

/**
 * «تقبّل الله منك» for about 2 s after a habit's tick (proposals item 7): one short line from the catalog
 * (`tazkiya.celebrations`), tied to the row that was ticked (`key`). No sound, no counter, no confetti.
 */
export function useCelebration() {
  const english = useLocale() === 'en';
  const catalog = usePracticeCatalog();
  const lines = catalog.data?.tazkiya?.celebrations;
  const [shown, setShown] = useState<{ key: string; line: string } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const celebrate = useCallback(
    (key: string) => {
      const line = celebrationLine(lines ? (english ? lines.linesEn : lines.linesAr) : [], turn);
      turn += 1;
      if (!line) return;
      if (timer.current !== null) window.clearTimeout(timer.current);
      setShown({ key, line });
      timer.current = window.setTimeout(() => setShown(null), CELEBRATION_MS);
    },
    [lines, english],
  );

  return { celebration: shown, celebrate };
}
