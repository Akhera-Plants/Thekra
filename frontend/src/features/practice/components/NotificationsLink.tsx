'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** Reminder switches live on one page only, «التنبيهات» (redesign §4.4); other screens link to it. */
export function NotificationsLink() {
  const t = useTranslations('practice.record');
  return (
    <Link href="/practice/notifications" className="text-link inline-flex items-center gap-2 self-start">
      <Bell aria-hidden className="size-4" />
      {t('notifications')}
    </Link>
  );
}
