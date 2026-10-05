'use client';

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface AnotherReminderButtonProps {
  onClick: () => void;
  isPending?: boolean;
  className?: string;
}

export function AnotherReminderButton({
  onClick,
  isPending,
  className,
}: AnotherReminderButtonProps) {
  const t = useTranslations('sinDetail');

  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={isPending}
      className={className}
      aria-label={t('anotherReminder')}
    >
      <RefreshCw
        className="size-4 me-2 motion-safe:transition-transform motion-safe:group-hover:rotate-180 motion-reduce:transition-none"
        aria-hidden
      />
      {t('anotherReminder')}
    </Button>
  );
}
