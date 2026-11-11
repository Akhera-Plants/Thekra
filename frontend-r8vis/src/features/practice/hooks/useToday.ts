import { useEffect, useState } from 'react';
import { todayFrom } from '@thekra/practice-core';

const TICK_MS = 60_000;

interface Clock {
  today: string;
  /** Minutes since local midnight. */
  minutes: number;
}

function read(): Clock {
  const now = new Date();
  return { today: todayFrom(now), minutes: now.getHours() * 60 + now.getMinutes() };
}

/** The device's local day and time, refreshed every minute while the page is open (null before mount). */
export function useToday(): Clock | null {
  const [clock, setClock] = useState<Clock | null>(null);
  useEffect(() => {
    const update = () => setClock(read());
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, TICK_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  return clock;
}
