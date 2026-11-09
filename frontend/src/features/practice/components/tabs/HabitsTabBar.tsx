'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { HABITS_TABS, habitsTabOf } from './habits-tabs';

/**
 * The tab bar of «عاداتي» (round 6 §2, reference underline tabs): «اليوم · العادات · الأعمال الدورية · محاسبتي ·
 * سجلّي». Each tab is a link to its own route (so it is a `<nav>` with `aria-current`, not an ARIA tablist). On a narrow
 * phone the row scrolls sideways instead of cutting a label; the current tab is scrolled into view by the browser's
 * focus order, and the hairline under the row is the reference's.
 */
export function HabitsTabBar() {
  const t = useTranslations('nav.menuItems');
  const tTabs = useTranslations('practice.tabs');
  const current = habitsTabOf(usePathname());
  return (
    <nav aria-label={tTabs('label')} className="w-full">
      <ul className="-mb-px flex w-full gap-1 overflow-x-auto overscroll-x-contain border-b border-border [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden">
        {HABITS_TABS.map((tab) => {
          const active = current === tab.key;
          return (
            <li key={tab.key} className="flex shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-11 items-center px-2 pb-2.5 pt-2 text-base whitespace-nowrap transition-colors duration-150 sm:px-1',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:content-['']",
                  active ? 'font-semibold text-primary-text after:bg-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
