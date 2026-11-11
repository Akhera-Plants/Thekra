'use client';

import { useTranslations } from 'next-intl';
import { appStoreLinks } from '@/lib/app-stores';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The store buttons for client components (the «صحبة» dialog): same rule, no address yet means one honest line. */
export function AppStoreLinks({ className }: { className?: string }) {
  const t = useTranslations('circlesApp');
  const links = appStoreLinks();
  if (links.length === 0) return <p className={cn('text-sm text-muted-foreground', className)}>{t('notYet')}</p>;
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11 px-4')}
        >
          {t(link.key)}
        </a>
      ))}
    </div>
  );
}
