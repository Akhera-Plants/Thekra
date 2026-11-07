'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { segmentListVariants, segmentTriggerVariants } from '@/components/shared/kit/segment-tabs/variants';
import { HABITS_TABS, habitsTabOf } from './habits-tabs';

/**
 * The tab bar of «عاداتي»: «ورد اليوم · الدورية · محاسبتي · سجلّي». Each tab is a link to its own route (so it is a
 * `<nav>` with `aria-current`, not an ARIA tablist); the look is the kit's segmented pill. On a narrow phone the four
 * pills fill the row equally, so none is cut off.
 */
export function HabitsTabBar() {
  const t = useTranslations('nav.menuItems');
  const tTabs = useTranslations('practice.tabs');
  const current = habitsTabOf(usePathname());
  return (
    <nav aria-label={tTabs('label')} className="w-full">
      <ul className={segmentListVariants({ variant: 'segment', size: 'filled', className: 'sm:w-fit' })}>
        {HABITS_TABS.map((tab) => (
          <li key={tab.key} className="flex min-w-0 flex-1 sm:flex-none">
            <Link
              href={tab.href}
              aria-current={current === tab.key ? 'page' : undefined}
              data-active={current === tab.key ? '' : undefined}
              className={segmentTriggerVariants({ variant: 'segment', size: 'filled', className: 'w-full !whitespace-normal px-1.5 text-center leading-5 sm:px-4' })}
            >
              {t(tab.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
