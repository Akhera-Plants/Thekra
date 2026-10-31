'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Bookmark, Feather, Repeat, Sprout } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { establishPlan, graduationReady, periodicActs, updatePlan, type Plan } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { habitOf } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePlanWords } from '../PlanCard';
import { ExcuseToggle } from './ExcuseToggle';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { accountsEnabled } from '@/lib/accounts';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { monthOf, type YearMonth } from '@/lib/practice/hub';
import { updatePrefs, updateStore } from '@/lib/practice/local-store';
import { wirdDay, wirdSummary } from '@/lib/practice/wird';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { PracticeLoading } from '../PracticeLoading';
import { HubMonth } from './HubMonth';
import { StreakFlame } from './StreakFlame';
import { TodayList } from './TodayList';

/**
 * «سجلّي», in this order (mirrors the app's tab): the streak (the number with the gold flame, and «أطول مداومة»), the one
 * month calendar (a tapped day opens its list under it, loggable for the last 7 days), «إظهار التاريخ الهجري», then
 * simple rows: «عاداتي», «أعمال دورية», «تخفَّف» and «المحفوظات».
 */
export function RecordView() {
  const context = useWirdContext();
  return context ? <Record context={context} /> : <PracticeLoading />;
}

function Record({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.record');
  const tWird = useTranslations('practice.wird');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { snapshot, today, habits, occasions, occasionBasis, planDays } = context;
  const { store, prefs } = snapshot;
  const showHijri = prefs.showHijri === true;
  const summary = useMemo(() => wirdSummary(store, today, planDays), [store, today, planDays]);
  const periodicCount = useMemo(() => periodicActs(store, today, planDays).length, [store, today, planDays]);
  const ready = useMemo(() => store.plans.filter((plan) => graduationReady(plan, today)), [store, today]);
  const [picked, setPicked] = useState<string | null>(null);
  const [month, setMonth] = useState<YearMonth>(() => monthOf(today));
  const pickedDay = useMemo(
    () => (picked ? wirdDay(store, picked, { occasions, ...planDays }) : null),
    [store, picked, occasions, planDays],
  );

  const links: { key: string; href: string; icon: ReactNode; title: string; hint: string }[] = [
    {
      key: 'habits',
      href: '/practice/habits',
      icon: <Sprout />,
      title: t('habits'),
      hint: t('habitsCount', { count: store.plans.length, n: formatDigits(store.plans.length) }),
    },
    {
      key: 'periodic',
      href: '/practice/periodic',
      icon: <Repeat />,
      title: t('periodic'),
      hint: t('periodicCount', { count: periodicCount, n: formatDigits(periodicCount) }),
    },
    { key: 'lighten', href: '/practice/leave-sin', icon: <Feather />, title: t('lighten'), hint: t('lightenHint') },
  ];
  if (accountsEnabled()) {
    links.push({ key: 'saved', href: '/favorites', icon: <Bookmark />, title: t('saved'), hint: t('savedHint') });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section aria-labelledby="record-streak" className="flex flex-col gap-1">
        <h2 id="record-streak" className="sr-only">
          {t('current')}
        </h2>
        {summary.display.kind === 'fresh' ? (
          <p className="flex items-center gap-2 text-lg">
            <StreakFlame className="size-7" />
            {tWird('streakFresh', { n: formatDigits(summary.display.longest) })}
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2">
              <StreakFlame className="size-9" />
              <span className="text-5xl leading-none font-medium tabular-nums">{formatDigits(summary.streak)}</span>
            </p>
            <p className="text-lg">{t('current')}</p>
            <p className="text-sm text-muted-foreground">
              {t('longest', { count: summary.longest, n: formatDigits(summary.longest) })}
            </p>
          </>
        )}
      </section>

      {ready.map((plan) => (
        <GraduationOffer key={plan.id} plan={plan} habits={habits} today={today} />
      ))}

      <div className="flex flex-col gap-3">
        <HubMonth
          store={store}
          today={today}
          selected={picked}
          month={month}
          occasions={occasions}
          planDays={planDays}
          showHijri={showHijri}
          onSelect={(date) => setPicked((current) => (current === date ? null : date))}
          onMonthChange={setMonth}
        />
        <label className="flex min-h-11 items-center gap-3 self-start text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={showHijri}
            onChange={(event) => updatePrefs((p) => ({ ...p, showHijri: event.target.checked }))}
          />
          {t('showHijri')}
        </label>
      </div>

      {picked && pickedDay ? (
        <TodayList
          title={picked === today ? tWird('today') : formatGregorian(picked, locale, true)}
          store={store}
          date={picked}
          today={today}
          day={pickedDay}
          habits={habits}
          occasionBasis={occasionBasis}
          footer={store.plans.length > 0 ? <ExcuseToggle store={store} today={today} date={picked} /> : null}
        />
      ) : null}

      <nav aria-label={t('linksLabel')}>
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {links.map((link) => (
            <li key={link.key}>
              <Link
                href={link.href}
                className="group flex min-h-14 items-center gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary [&_svg]:size-[1.125rem]">
                  {link.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base leading-7 font-medium">{link.title}</span>
                  <span className="text-sm leading-6 text-muted-foreground">{link.hint}</span>
                </span>
                <DirectionalArrow className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** «رسخت هذه العادة بفضل الله. انقلها إلى الراسخة؟»: offered, never automatic. */
function GraduationOffer({ plan, habits, today }: { plan: Plan; habits: ReadonlyMap<string, PracticeHabit>; today: string }) {
  const t = useTranslations('practice.today');
  const words = usePlanWords(plan, habitOf(plan, habits));
  return (
    <div className="next-step !mt-0 flex flex-col items-start gap-2">
      <p>
        <strong lang={words.titleLang}>{words.title}</strong> · {t('graduateOffer')}
      </p>
      <Button
        className="h-auto whitespace-normal py-2 text-start"
        variant="outline"
        tone="primary"
        size="sm"
        onClick={() => updateStore((s) => updatePlan(s, plan.id, (p) => establishPlan(p, today)))}
      >
        {t('graduate')}
      </Button>
    </div>
  );
}
