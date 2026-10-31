'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Bookmark, Feather, Repeat, Sprout } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { periodicActs } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { accountsEnabled } from '@/lib/accounts';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { monthOf, type YearMonth } from '@/lib/practice/hub';
import { updatePrefs } from '@/lib/practice/local-store';
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
        <p className="flex items-center gap-2">
          <StreakFlame className="size-9" />
          <span className="text-5xl leading-none font-medium tabular-nums">{formatDigits(summary.streak)}</span>
        </p>
        <p className="text-lg">{t('current')}</p>
        <p className="text-sm text-muted-foreground">
          {t('longest', { count: summary.longest, n: formatDigits(summary.longest) })}
        </p>
      </section>

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
