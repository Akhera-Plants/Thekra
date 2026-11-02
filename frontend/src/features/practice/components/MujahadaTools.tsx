'use client';

import { useMemo, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatCountdown, logMinimum, minimumToLog, updatePlan, type HabitItem, type Plan, type UrgeProgress } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { QuoteCard } from '@/components/shared/quote';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDigits } from '@/lib/format/digits';
import { updateStore } from '@/lib/practice/local-store';
import { rewardRange, REWARD_MAX, REWARD_MIN } from '@/lib/practice/mujahada';
import { habitOf } from '@/lib/practice/plans';
import { wirdDay } from '@/lib/practice/wird';
import type { QuoteDto } from '@/lib/types/api';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import type { WirdContext } from '../hooks/useWirdContext';
import { usePlanWords } from './PlanCard';

const PHRASES = ['subhan', 'hamd', 'tahlil', 'takbir', 'istighfar'] as const;
type Phrase = (typeof PHRASES)[number];

interface TasbihDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The ten-minute timer of the page (it keeps running behind the dialog). */
  progress: UrgeProgress;
  /** «الحسنة بعشر أمثالها إلى سبعمائة ضعف», by id; hidden while it cannot be read. */
  hadith: QuoteDto | null;
}

/**
 * The tasbih counter while the timer runs: the time left, the count (one big tap target; the count stays on the
 * screen only) and what it is written as: × 10 up to × 700, «إن قبله الله».
 */
export function TasbihDialog({ open, onOpenChange, progress, hadith }: TasbihDialogProps) {
  const t = useTranslations('leaveSin.moment.tasbih');
  const [phrase, setPhrase] = useState<Phrase>('subhan');
  const [count, setCount] = useState(0);
  const reward = rewardRange(count);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('remaining', { time: formatCountdown(progress.remaining) })}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-5 text-center">
          <ul className="flex flex-wrap justify-center gap-2" aria-label={t('phrasesLabel')}>
            {PHRASES.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={phrase === key}
                  onClick={() => setPhrase(key)}
                  className={cn(
                    'min-h-11 rounded-lg border px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    phrase === key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary',
                  )}
                >
                  {t(`phrases.${key}`)}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setCount((n) => n + 1)}
            aria-label={t('tap', { phrase: t(`phrases.${phrase}`), n: formatDigits(count) })}
            className="flex size-40 flex-col items-center justify-center gap-1 rounded-full border-4 border-primary bg-primary/5 text-primary transition-transform duration-100 ease-out select-none active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:active:scale-100"
          >
            <span className="text-5xl font-medium tabular-nums" aria-hidden>
              {formatDigits(count)}
            </span>
            <span className="text-sm" aria-hidden>
              {t(`phrases.${phrase}`)}
            </span>
          </button>
          <p className="text-base leading-8" role="status">
            {count === 0
              ? t('rewardStart', { min: formatDigits(REWARD_MIN), max: formatDigits(REWARD_MAX) })
              : t('reward', { min: formatDigits(reward.min), max: formatDigits(reward.max) })}
          </p>
          <Button variant="outline" tone="neutral" size="sm" onClick={() => setCount(0)} disabled={count === 0}>
            <RotateCcw aria-hidden />
            {t('reset')}
          </Button>
          {hadith ? (
            <div className="w-full text-start">
              <QuoteCard quote={hadith} density="compact" intent="good-deed" detailHref={`/quotes/${hadith.id}`} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ShortWirdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: WirdContext;
  /** «صلاة القاعد على النصف من صلاة القائم», by id; hidden while it cannot be read. */
  hadith: QuoteDto | null;
}

/**
 * «وردٌ أقصر»: do a smaller amount of today's habits now and log it (practice-core `logMinimum`, which counts for the
 * day), and the sitting prayer: a voluntary prayer sitting has half the reward of standing.
 */
export function ShortWirdDialog({ open, onOpenChange, context, hadith }: ShortWirdDialogProps) {
  const t = useTranslations('leaveSin.moment.wird');
  const { snapshot, today, habits, occasions, planDays } = context;
  const store = snapshot.store;
  const day = useMemo(() => wirdDay(store, today, { occasions, ...planDays }), [store, today, occasions, planDays]);
  const rows = [...day.open, ...day.done].filter((item): item is HabitItem => item.kind === 'habit');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('lead')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {rows.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {rows.map((item) => {
                const plan = store.plans.find((p) => p.id === item.planId);
                return plan ? <ShortRow key={plan.id} plan={plan} habit={habitOf(plan, habits)} today={today} /> : null;
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t('none')}</p>
          )}
          <section aria-labelledby="sitting-title" className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-4">
            <h3 id="sitting-title" className="font-medium">
              {t('sittingTitle')}
            </h3>
            <p className="text-sm leading-7 text-muted-foreground">{t('sittingBody')}</p>
            {hadith ? <QuoteCard quote={hadith} density="compact" intent="good-deed" detailHref={`/quotes/${hadith.id}`} /> : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortRow({ plan, habit, today }: { plan: Plan; habit: PracticeHabit | undefined; today: string }) {
  const t = useTranslations('leaveSin.moment.wird');
  const words = usePlanWords(plan, habit);
  const amount = minimumToLog(plan, today);
  const done = (plan.log[today] ?? 0) > 0;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="font-medium" lang={words.titleLang} dir={words.titleLang ? 'rtl' : undefined}>
        {words.title}
      </span>
      {amount !== null ? (
        <Button
          variant="outline"
          tone="primary"
          size="sm"
          onClick={() => updateStore((s) => updatePlan(s, plan.id, (p) => logMinimum(p, today, today)))}
        >
          {t('log', { amount: words.amount(amount) })}
        </Button>
      ) : done ? (
        <span className="flex items-center gap-1 text-sm text-primary">
          <Check className="size-4" aria-hidden />
          {t('logged')}
        </span>
      ) : null}
    </li>
  );
}
