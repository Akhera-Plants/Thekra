import { useEffect, useRef } from 'react';

/**
 * Moves keyboard and screen-reader focus to the returned element whenever `key` changes (not on the first
 * render): a step or view replaced the control that had focus, so focus would otherwise fall to the page.
 */
export function useFocusOnChange<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.focus({ preventScroll: false });
  }, [key]);
  return ref;
}
