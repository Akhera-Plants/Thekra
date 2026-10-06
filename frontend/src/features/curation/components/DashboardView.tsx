'use client';

/**
 * DashboardView — coverage-gap dashboard for the admin.
 *
 * Shows sins and good deeds with few (< threshold) or zero quote links,
 * so curators know where to focus triage effort.
 *
 * Data source: public list APIs (GET /sins, GET /good-deeds) which include
 * quoteCount. No dedicated /admin/stats endpoint needed.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getSins } from '@/lib/api/sins';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Heart, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const LOW_THRESHOLD = 3;

function CoverageCard({
  href,
  nameAr,
  name,
  count,
  intent,
}: {
  href: string;
  nameAr: string;
  name: string;
  count: number;
  intent: 'sin' | 'deed';
}) {
  const isZero = count === 0;
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-[opacity] duration-150 ease-out hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-base font-arabic" dir="rtl">{nameAr}</span>
        <span className="truncate text-xs text-muted-foreground">{name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant={isZero ? 'destructive' : 'secondary'}
          aria-label={`${count} quotes`}
        >
          {count}
        </Badge>
        <ArrowRight
          className={cn('h-4 w-4 text-muted-foreground rtl:-scale-x-100', intent === 'sin' ? 'text-destructive/60' : 'text-primary/60')}
          aria-hidden
        />
      </div>
    </Link>
  );
}

function CoverageSection({
  title,
  icon: Icon,
  items,
  isLoading,
  linkPrefix,
  intent,
  emptyLabel,
}: {
  title: string;
  icon: React.ElementType;
  items: Array<{ id: string; slug: string; nameAr: string; name: string; quoteCount: number }>;
  isLoading: boolean;
  linkPrefix: string;
  intent: 'sin' | 'deed';
  emptyLabel: string;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
        <h2 className="text-xl font-semibold">{title}</h2>
        {!isLoading && (
          <Badge variant="outline" className="ms-auto">
            {items.length}
          </Badge>
        )}
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {items.map((item) => (
            <li key={item.id}>
              <CoverageCard
                href={`${linkPrefix}?sinSlug=${item.slug}`}
                nameAr={item.nameAr}
                name={item.name}
                count={item.quoteCount}
                intent={intent}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DashboardView() {
  const t = useTranslations('admin');

  const { data: sinsResult, isLoading: sinsLoading } = useQuery({
    queryKey: queryKeys.sins.list({ limit: 100 }),
    queryFn: () => getSins({ limit: 100 }),
  });

  const { data: deedsResult, isLoading: deedsLoading } = useQuery({
    queryKey: queryKeys.goodDeeds.list({ limit: 100 }),
    queryFn: () => getGoodDeeds({ limit: 100 }),
  });

  const lowSins = useMemo(
    () => (sinsResult?.data ?? []).filter((s) => s.quoteCount < LOW_THRESHOLD),
    [sinsResult],
  );

  const lowDeeds = useMemo(
    () => (deedsResult?.data ?? []).filter((d) => d.quoteCount < LOW_THRESHOLD),
    [deedsResult],
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{t('dashboard.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('dashboard.subtitle', { threshold: LOW_THRESHOLD })}</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <CoverageSection
          title={t('dashboard.sinsSection')}
          icon={AlertTriangle}
          items={lowSins}
          isLoading={sinsLoading}
          linkPrefix="/admin/linking"
          intent="sin"
          emptyLabel={t('dashboard.allSinsCovered')}
        />
        <CoverageSection
          title={t('dashboard.deedsSection')}
          icon={Heart}
          items={lowDeeds}
          isLoading={deedsLoading}
          linkPrefix="/admin/linking"
          intent="deed"
          emptyLabel={t('dashboard.allDeedsCovered')}
        />
      </div>
    </div>
  );
}
