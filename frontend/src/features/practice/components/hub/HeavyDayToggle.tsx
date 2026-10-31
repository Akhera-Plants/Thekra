'use client';

import { Feather } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Store } from '@thekra/practice-core';
import { updateStore } from '@/lib/practice/local-store';
import { isEbbDay, setEbbForAll } from '@/lib/practice/plans';

/**
 * «يومي ثقيل» as one line: a pressed toggle. On, every plan asks only its smallest amount today (practice-core
 * `isEbbOn`); tomorrow the plans are back by themselves.
 */
export function HeavyDayToggle({ store, today }: { store: Store; today: string }) {
  const t = useTranslations('practice.wird');
  const isHeavy = isEbbDay(store.plans, today);
  return (
    <button
      type="button"
      className="outline-button button-wrap !mt-0 !min-h-11 self-start"
      aria-pressed={isHeavy}
      title={t('heavyDayHint')}
      onClick={() => updateStore((s) => setEbbForAll(s, !isHeavy, today))}
    >
      <Feather aria-hidden />
      {t('heavyDay')}
    </button>
  );
}
