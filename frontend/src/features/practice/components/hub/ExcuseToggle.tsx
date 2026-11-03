'use client';

import { useId } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { canExcuse, isExcused, toggleExcusedDay, type Store } from '@thekra/practice-core';
import { updateStore } from '@/lib/practice/local-store';

interface ExcuseToggleProps {
  store: Store;
  today: string;
  /** The day to mark («عاداتي» › «الشهر»: the picked calendar day). Without it, today («عذر أمس» is gone, round 3). */
  date?: string;
}

/**
 * «عذر (مرض أو سفر)»: a pressed toggle per day. An excused day neither breaks nor adds to the streak, and is not
 * «missed yesterday» (practice-core `toggleExcusedDay`, kept in the synced settings).
 */
export function ExcuseToggle({ store, today, date }: ExcuseToggleProps) {
  const t = useTranslations('practice.excuse');
  const days = date ? [date] : [today];
  return (
    <>
      {days.filter((d) => canExcuse(d, today)).map((d) => (
        <DayToggle key={d} store={store} today={today} date={d} label={d === today ? t('today') : t('day')} />
      ))}
    </>
  );
}

function DayToggle({ store, today, date, label }: { store: Store; today: string; date: string; label: string }) {
  const t = useTranslations('practice.excuse');
  const id = useId();
  const on = isExcused(store, date);
  return (
    <button
      type="button"
      id={id}
      className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-full border border-border px-3 !text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:text-primary motion-reduce:transition-none [&_svg]:size-4"
      aria-pressed={on}
      title={t('hint')}
      onClick={() => updateStore((s) => toggleExcusedDay(s, date, today))}
    >
      <ShieldCheck aria-hidden />
      {label}
    </button>
  );
}
