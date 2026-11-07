/** The current time, refreshed every minute (the next-prayer line counts down). */

import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Align to the next minute, then tick every minute.
    let interval: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), MINUTE_MS);
    }, MINUTE_MS - (Date.now() % MINUTE_MS));
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, []);
  return now;
}
