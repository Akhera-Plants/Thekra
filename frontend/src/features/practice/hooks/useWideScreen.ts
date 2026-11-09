import { useSyncExternalStore } from 'react';

/** Tailwind `lg` (64rem): the practice pages put several groups side by side and a side column from here. */
const QUERY = '(min-width: 64rem)';

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** True on a wide screen. The server snapshot is the phone layout (one group at a time), which is also the safe one. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
