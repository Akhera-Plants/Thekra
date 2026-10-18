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
  /** Short labels: Arabic stays native; English is just "En". */
  const otherLabel = otherLocale === 'ar' ? 'العربية' : 'En';

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
      <span lang={otherLocale === 'ar' ? 'ar' : 'en'} dir={otherLocale === 'ar' ? 'rtl' : 'ltr'}>
        {otherLabel}
      </span>
    </Link>
  );
}
