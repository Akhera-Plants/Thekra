'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { preservedQuery } from '@/lib/search/preserved-query';
import { cn } from '@/lib/utils';

interface LocaleSwitcherProps {
  label: string;
  className?: string;
}

export function LocaleSwitcher({ label, className }: LocaleSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const otherLocale = locale === 'ar' ? 'en' : 'ar';

  // next-intl's locale Link never prefetches (it is hard-wired to prefetch={false}), so the switch
  // used to wait for the whole page. The pages are cached now: fetch the other locale's version of
  // this route once the page is idle, and the switch is a client navigation with the data in hand.
  useEffect(() => {
    const prefetch = () => router.prefetch(pathname, { locale: otherLocale });
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(prefetch);
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(prefetch, 1500);
    return () => clearTimeout(timer);
  }, [router, pathname, otherLocale]);
  /** Short labels: Arabic stays native; English is just "En". */
  const otherLabel = otherLocale === 'ar' ? 'العربية' : 'En';

  return (
    <Link
      href={pathname}
      locale={otherLocale}
      data-locale-switch=""
      aria-label={label}
      onClick={(event) => {
        // Keep the theme chip and the catalogue search (audit B09). They live in the address bar,
        // written on the client, so they are read at click time; a modified click opens the plain page.
        const query = preservedQuery(window.location.search);
        if (!query || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        router.push(`${pathname}${query}`, { locale: otherLocale });
      }}
      onPointerEnter={() => router.prefetch(pathname, { locale: otherLocale })}
      onFocus={() => router.prefetch(pathname, { locale: otherLocale })}
      className={cn(
        'inline-flex min-h-11 items-center px-2 text-[15px] text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 md:text-base',
        className,
      )}
    >
      <span lang={otherLocale === 'ar' ? 'ar' : 'en'} dir={otherLocale === 'ar' ? 'rtl' : 'ltr'}>
        {otherLabel}
      </span>
    </Link>
  );
}
