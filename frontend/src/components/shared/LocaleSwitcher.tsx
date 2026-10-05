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
      aria-label={label}
      className={cn(
        'text-sm text-muted-foreground transition-[opacity,transform] duration-150 ease-out hover:text-foreground hover:opacity-90 motion-reduce:transition-none',
        className,
      )}
    >
      {otherLabel}
    </Link>
  );
}
