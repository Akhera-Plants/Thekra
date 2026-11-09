'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { activePrograms, DAY_STATES, dayStateOn, setDayState, type DayState, type Store } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { updateStore } from '@/lib/practice/local-store';
import { cn } from '@/lib/utils';

/**
 * «حال يومي» (round 6, C-01r; glossary `day-state`): ONE button beside the day's title that opens a list — يوم عادي ·
 * مرض شديد · انشغالات طارئة · سفر (practice-core `setDayState`; the round-5 «يوم ثقيل» / «عذر» data keeps its meaning).
 * A hard state asks each habit only its «القدر الأدنى»; the gentle line under the title says so ({@link DayStateLine}).
 * The button names the state that is on.
 */
export function DayStateMenu({ store, today }: { store: Store; today: string }) {
  const t = useTranslations('practice.dayState');
  const [open, setOpen] = useState(false);
  const view = dayStateOn(store, today);
  const name = (state: DayState) => (view.legacy && state === 'sick' && view.state === 'sick' ? t('states.legacySick') : t(`states.${state}`));
  if (store.plans.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          tone={view.state === 'normal' ? 'neutral' : 'primary'}
          size="sm"
          aria-label={view.state === 'normal' ? t('label') : t('labelWith', { state: name(view.state) })}
        >
          {view.state === 'normal' ? t('label') : name(view.state)}
          <ChevronDown aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-1 p-2">
        <p className="px-3 pt-1 pb-2 text-sm leading-6 text-muted-foreground">{t('question')}</p>
        <ul role="radiogroup" aria-label={t('label')} className="flex flex-col gap-1">
          {DAY_STATES.map((state) => {
            const on = view.state === state;
            return (
              <li key={state}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setOpen(false);
                      if (on) return;
                      updateStore((s) => setDayState(s, today, state, today));
                      toast.success(state === 'normal' ? t('savedNormal') : t('saved', { state: t(`states.${state}`) }));
                    }}
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
                      <span className="text-sm font-medium">{name(state)}</span>
                      <span className="text-xs leading-5 text-muted-foreground">{t(`hints.${state}`)}</span>
                    </span>
                  </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The gentle line of a hard day, under the day's title: for the habits «سامح نفسك اليوم…» and the minimum; for a
 * running «تخفَّف» program a firm and kind line instead of forgiveness (never «سامح نفسك» about a sin), generic. The
 * same words as the app (`habitsHub.dayState.forgive` / `lighten`).
 */
export function DayStateLine({ store, today }: { store: Store; today: string }) {
  const t = useTranslations('practice.dayState');
  const view = dayStateOn(store, today);
  if (view.state === 'normal') return null;
  const lighten = activePrograms(store.programs).length > 0;
  return (
    <div role="status" className="flex flex-col gap-1 rounded-2xl border border-primary/30 bg-secondary/60 px-4 py-3 text-sm leading-7">
      <p>{t('gentle')}</p>
      {lighten ? <p className="text-muted-foreground">{t('gentleLighten')}</p> : null}
    </div>
  );
}
