'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';

/**
 * Reminder switches live on one page only, «التنبيهات» (redesign §4.4); other pages link to it from their title line,
 * icon + text, opposite the title (W-13), never as a lone button at the bottom.
 */
export function NotificationsLink() {
  const t = useTranslations('practice.record');
  return (
    <Button asChild variant="outline" tone="primary" size="sm">
      <Link href="/practice/notifications">
        <Bell aria-hidden />
        {t('notifications')}
      </Link>
    </Button>
  );
}
