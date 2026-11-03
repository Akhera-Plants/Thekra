'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { setHeartPrefs } from '@thekra/practice-core';
import { Switch } from '@/components/shared/kit/switch';
import { updateHeart } from '@/lib/practice/heart-store';
import { useHeart } from '../hooks/useHeart';
import { useWirdContext } from '../hooks/useWirdContext';
import { PledgeList } from './Pledges';
import { PracticeLoading } from './PracticeLoading';

/** «التزام شخصي»: the switch, then every habit with its own make-up deed. */
export function PledgesView() {
  const t = useTranslations('practice.pledges');
  const context = useWirdContext();
  const heart = useHeart();
  const switchLabel = useId();
  if (!context || !heart) return <PracticeLoading />;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-2">
        <span id={switchLabel} className="text-base font-medium">
          {t('switch')}
        </span>
        <Switch
          aria-labelledby={switchLabel}
          checked={heart.prefs.pledges}
          onCheckedChange={(on) => updateHeart((h) => setHeartPrefs(h, { pledges: on }))}
        />
      </div>
      <PledgeList plans={context.snapshot.store.plans} heart={heart} habits={context.habits} today={context.today} />
    </div>
  );
}
