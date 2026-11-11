'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { Link } from '@/i18n/navigation';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { getSins } from '@/lib/api/sins';
import { topicName } from '@/lib/format/admin-labels';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { formatCount } from '../kit/format';

const LOW_THRESHOLD = 3;

interface Topic {
  id: string;
  name: string;
  nameAr: string;
  quoteCount: number;
}

/**
 * «مواضيع تحتاج نصوصًا» — two dense columns (sins | good deeds), name + count.
 * Data: public GET /sins and GET /good-deeds (quoteCount), as the previous dashboard.
 */
export function TopicsNeedingTexts() {
  const t = useTranslations('admin.home');
  const sins = useQuery({
    queryKey: queryKeys.sins.list({ limit: 100 }),
    queryFn: () => getSins({ limit: 100 }),
  });
  const deeds = useQuery({
    queryKey: queryKeys.goodDeeds.list({ limit: 100 }),
    queryFn: () => getGoodDeeds({ limit: 100 }),
  });

  return (
    <section aria-labelledby="topics-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="topics-title" className="text-lg font-semibold">{t('topicsTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('topicsDescription', { threshold: formatCount(LOW_THRESHOLD) })}</p>
      </div>
      <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        <TopicColumn
          title={t('sinsCol')}
          query={sins}
          hrefFor={(topic) => `/admin/linking?tab=manual&sin=${topic.id}`}
          emptyLabel={t('allCovered')}
          errorLabel={t('loadError')}
          retryLabel={t('retry')}
        />
        <TopicColumn
          title={t('deedsCol')}
          query={deeds}
          hrefFor={() => '/admin/linking?kind=good-deed'}
          emptyLabel={t('allCovered')}
          errorLabel={t('loadError')}
          retryLabel={t('retry')}
        />
      </div>
    </section>
  );
}

function TopicColumn({
  title,
  query,
  hrefFor,
  emptyLabel,
  errorLabel,
  retryLabel,
}: {
  title: string;
  query: { data?: { data: Topic[] }; isLoading: boolean; isError: boolean; refetch: () => unknown };
  hrefFor: (topic: Topic) => string;
  emptyLabel: string;
  errorLabel: string;
  retryLabel: string;
}) {
  const locale = useLocale();
  const low = useMemo(
    () =>
      (query.data?.data ?? [])
        .filter((topic) => topic.quoteCount < LOW_THRESHOLD)
        .sort((a, b) => a.quoteCount - b.quoteCount),
    [query.data],
  );

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex h-8 items-center justify-between border-b border-border text-xs font-medium text-muted-foreground">
        <span>{title}</span>
        {!query.isLoading && !query.isError ? <span className="tabular-nums">{formatCount(low.length)}</span> : null}
      </div>
      {query.isError ? (
        <ErrorState message={errorLabel} retryLabel={retryLabel} onRetry={() => void query.refetch()} className="py-6" />
      ) : query.isLoading ? (
        Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="my-2.5 h-3.5 w-full" />)
      ) : low.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col">
          {low.map((topic) => (
            <li key={topic.id}>
              <Link
                href={hrefFor(topic)}
                className="desk-press flex h-9 items-center justify-between gap-3 border-b border-border/50 px-1 text-sm outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate">{topicName(topic, locale)}</span>
                <span
                  className={cn(
                    'shrink-0 text-xs tabular-nums',
                    topic.quoteCount === 0 ? 'font-medium text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {formatCount(topic.quoteCount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
