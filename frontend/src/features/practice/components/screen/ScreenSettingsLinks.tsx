'use client';

import { Clock, NotebookPen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** «تذكيراتي» and «أوقات الصلاة» from الإعدادات (redesign §4.6). */
export function ScreenSettingsLinks() {
  const tMine = useTranslations('practice.myReminders');
  const tPrayer = useTranslations('practice.prayer');
  return (
    <>
      <Link href={{ pathname: '/favorites', query: { tab: 'reminders' } }} className="text-link inline-flex items-center gap-2 self-start">
        <NotebookPen aria-hidden className="size-4" />
        {tMine('title')}
      </Link>
      <Link href="/practice/prayer-times" className="text-link inline-flex items-center gap-2 self-start">
        <Clock aria-hidden className="size-4" />
        {tPrayer('title')}
      </Link>
    </>
  );
}
