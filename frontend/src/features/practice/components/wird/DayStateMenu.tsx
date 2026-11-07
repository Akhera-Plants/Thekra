'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { canExcuse, isExcused, toggleExcusedDay, type Store } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isEbbDay, setEbbForAll } from '@/lib/practice/plans';
import { updateStore } from '@/lib/practice/local-store';
import { cn } from '@/lib/utils';

/**
 * «حال يومي» (round 5, F-34 / F-35 a; glossary `day-state`): ONE small control beside the day's title, the same on the
 * app. It opens two choices, each a pressed toggle for today: «يوم ثقيل» (every habit asks only its smallest amount; the
 * plans come back tomorrow by themselves) and «عذر (مرض أو سفر)» (the day neither breaks nor adds to the streak). The
 * button names the state that is on.
 */
export function DayStateMenu({ store, today }: { store: Store; today: string }) {
  const t = useTranslations('practice.dayState');
  const heavy = isEbbDay(store.plans, today);
  const excused = isExcused(store, today);
  const state = excused ? t('excused') : heavy ? t('heavy') : null;
  if (store.plans.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" tone={state ? 'primary' : 'neutral'} size="sm" aria-label={state ? t('labelWith', { state }) : t('label')}>
          {state ? t('labelWith', { state }) : t('label')}
          <ChevronDown aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-1 p-2">
        <Choice
          label={t('heavy')}
          hint={t('heavyHint')}
          on={heavy}
          onToggle={() => updateStore((s) => setEbbForAll(s, !heavy, today))}
        />
        {canExcuse(today, today) ? (
          <Choice label={t('excused')} hint={t('excusedHint')} on={excused} onToggle={() => updateStore((s) => toggleExcusedDay(s, today, today))} />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function Choice({ label, hint, on, onToggle }: { label: string; hint: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        'flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-muted',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        on && 'bg-secondary',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
          on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
        )}
      >
        {on ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs leading-5 text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
