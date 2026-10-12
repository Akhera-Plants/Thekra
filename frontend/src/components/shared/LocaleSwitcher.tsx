'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface LocaleSwitcherProps {
  label: string;
  className?: string;
}

export function LocaleSwitcher({ label, className }: LocaleSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const otherLocale = locale === 'ar' ? 'en' : 'ar';
  const otherLabel = otherLocale === 'ar' ? 'العربية' : 'English';

  return (
    <Link
      href={pathname}
      locale={otherLocale}
      data-locale-switch=""
      aria-label={label}
      className={cn(
        'inline-flex min-h-11 items-center px-2 text-base text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {otherLabel}
    </Link>
  );
}
