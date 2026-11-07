'use client';

import { useSyncExternalStore } from 'react';
import { CalendarCheck, CalendarX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { setHomeSections, setHomeSectionVisible } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { useSession } from '@/features/auth/hooks/useSession';
import { usePracticeStore } from '@/features/practice/hooks/usePracticeStore';
import { updatePrefs, updateStore } from '@/lib/practice/local-store';
import { weekBranchOn } from '@/lib/practice/week-branch';

const noSubscribe = () => () => {};

/**
 * «ادرس شعبة كل أسبوع» / «أوقف شعبة الأسبوع» (owner round 5, F-18 a; the app's `branches/index.tsx`): it shows or hides
 * the home section `week-branch` (practice-core home sections, synced with the app). It also clears the round-3 device
 * switch (`prefs.weekBranch`), so «شعبة الأسبوع» stays one choice. Members only: a visitor's home has its fixed order.
 */
export function WeekBranchButton() {
  const t = useTranslations('branches.week');
  const { isAuthenticated } = useSession();
  const snapshot = usePracticeStore();
  // The same as the server render until mounted (the session and the device store exist only in the browser).
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!mounted || !isAuthenticated || !snapshot) return null;
  const on = weekBranchOn(snapshot.store, snapshot.prefs);

  function handleClick() {
    updateStore((store) => setHomeSections(store, setHomeSectionVisible(store.settings.homeSections, 'week-branch', !on)));
    updatePrefs((p) => (p.weekBranch === undefined ? p : { ...p, weekBranch: undefined }));
    toast.success(on ? t('offToast') : t('onToast'));
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        variant={on ? 'outline' : 'solid'}
        tone="branch"
        size="md"
        icon={on ? <CalendarX aria-hidden /> : <CalendarCheck aria-hidden />}
        onClick={handleClick}
      >
        {on ? t('stop') : t('start')}
      </Button>
      {on ? null : <p className="text-sm leading-6 text-muted-foreground">{t('hint')}</p>}
    </div>
  );
}
