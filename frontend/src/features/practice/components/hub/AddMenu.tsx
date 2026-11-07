'use client';

import type { ComponentProps, ReactNode } from 'react';
import { CalendarClock, HandHeart, NotebookPen, Plus, Sprout } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { fardEnabled, limitBlock, limits, setFardTracking, type Store } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { limitOptions } from '@/lib/practice/limits';
import { updateStore } from '@/lib/practice/local-store';
import type { PracticeHabit } from '@/lib/types/practice';

interface AddItemProps {
  href: ComponentProps<typeof Link>['href'];
  icon: ReactNode;
  title: string;
  hint: string;
}

function ItemBody({ icon, title, hint }: Omit<AddItemProps, 'href'>) {
  return (
    <>
      <span aria-hidden className="mt-0.5 text-primary-text [&_svg]:size-[1.125rem]">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs leading-5 text-muted-foreground">{hint}</span>
      </span>
    </>
  );
}

function AddItem({ href, ...body }: AddItemProps) {
  return (
    <DropdownMenuItem asChild className="items-start gap-3 rounded-lg px-2.5 py-2.5">
      <Link href={href}>
        <ItemBody {...body} />
      </Link>
    </DropdownMenuItem>
  );
}

interface AddMenuProps {
  store: Store;
  today: string;
  habits: ReadonlyMap<string, PracticeHabit>;
}

/**
 * «أضف» on «ورد اليوم» (owner round 3, item 10; round 5 F-30 a / F-05 a): «عادة» with the limit visible before the tap
 * («3 من 3 · يتسع لعادة جديدة يوم 3 ديسمبر»), «عمل دوري» (outside the habit limit), «تخفَّف» (generic wording only) and,
 * while it is off, «الفرائض».
 */
export function AddMenu({ store, today, habits }: AddMenuProps) {
  const t = useTranslations('practice.hub.add');
  const tFard = useTranslations('practice.fard');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const opts = limitOptions(habits);
  const sapling = limits(store, today, opts).sapling;
  const block = sapling.full ? limitBlock(store, today, 'sapling', opts) : null;
  const count = t('habitCount', { n: formatDigits(sapling.count), max: formatDigits(sapling.max) });
  const habitHint = block
    ? block.unlocksOn
      ? t('habitFullOn', { count, date: formatGregorian(block.unlocksOn, locale) })
      : t('habitFull', { count })
    : `${count} · ${t('habitHint')}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="solid-button button-wrap !mt-0 !min-h-11" aria-label={t('label')}>
          <Plus aria-hidden className="!block" />
          {t('button')}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-1.5">
        <AddItem href={{ pathname: '/practice', query: { add: '1' } }} icon={<Sprout />} title={t('habit')} hint={habitHint} />
        <AddItem href="/practice/periodic" icon={<CalendarClock />} title={t('periodic')} hint={t('periodicHint')} />
        <AddItem href="/practice/leave-sin" icon={<NotebookPen />} title={t('program')} hint={t('programHint')} />
        {!fardEnabled(store) ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="items-start gap-3 rounded-lg px-2.5 py-2.5"
              onSelect={() => {
                updateStore((s) => setFardTracking(s, true));
                toast.success(tFard('shown'));
              }}
            >
              <ItemBody icon={<HandHeart />} title={tFard('title')} hint={tFard('addHint')} />
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
