'use client';

import { Feather } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Store } from '@thekra/practice-core';
import { updateStore } from '@/lib/practice/local-store';
import { isEbbDay, setEbbForAll } from '@/lib/practice/plans';

/**
 * «يومي ثقيل» as one line: a pressed toggle. On, every plan asks only its smallest amount today (practice-core
 * `isEbbOn`); tomorrow the plans are back by themselves. The hadith «إذا مرض العبد أو سافر…» is not shown here
 * (owner round 3, item 8): «ورد اليوم» shows it after such a day has passed, when the commitment is above 60%.
 */
export function HeavyDayToggle({ store, today }: { store: Store; today: string }) {
  const t = useTranslations('practice.wird');
  const isHeavy = isEbbDay(store.plans, today);
  return (
    <button
      type="button"
      className="touch-44 inline-flex min-h-9 items-center gap-1.5 self-start rounded-full border border-border px-3 !text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:text-primary-text motion-reduce:transition-none [&_svg]:size-4"
      aria-pressed={isHeavy}
      title={t('heavyDayHint')}
      onClick={() => updateStore((s) => setEbbForAll(s, !isHeavy, today))}
    >
      <Feather aria-hidden />
      {t('heavyDay')}
    </button>
  );
}
