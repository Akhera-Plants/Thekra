'use client';

import { useEffect, useState } from 'react';

/** The value, settled for `delay` ms (design-system.mdc §4: search inputs debounce at 300 ms). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
