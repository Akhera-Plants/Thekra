'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Link } from '@/i18n/navigation';
import { getCatalogSources, type CatalogSource } from '@/lib/api/sources';
import { adminLabel, sourceName } from '@/lib/format/admin-labels';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { useSourceLedgerCounts } from '../../hooks/useAdminReview';
import { formatCount } from '../kit/format';

type CountCell = { data?: number; isLoading: boolean; isError: boolean };

/**
 * «حالة المكتبة» — one ledger line per source: imported → graded → linked → published.
 * imported / published come from GET /sources (quoteCount / publishedQuoteCount);
 * graded = admin quotes with grade ∈ {صحيح، حسن، ضعيف}; linked = imported − unlinkedOnly.
 * The bar is published ÷ imported. Nothing is estimated.
 */
export function LibraryLedger() {
  const t = useTranslations('admin.home');
  const locale = useLocale();
  const sourcesQuery = { limit: 100 };
  const sources = useQuery({
    queryKey: [...queryKeys.sources.list(sourcesQuery), 'catalog'],
    queryFn: () => getCatalogSources(sourcesQuery),
  });

  const rows = useMemo(
    () => [...(sources.data?.data ?? [])].sort((a, b) => b.quoteCount - a.quoteCount),
    [sources.data],
  );
  const ledger = useSourceLedgerCounts(rows.filter((s) => s.quoteCount > 0).map((s) => s.id));
  const countsById = new Map(ledger.map((entry) => [entry.sourceId, entry]));

  return (
    <section aria-labelledby="ledger-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="ledger-title" className="text-lg font-semibold">{t('libraryTitle')}</h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">{t('libraryDescription')}</p>
      </div>
      {sources.isError ? (
        <ErrorState message={t('loadError')} retryLabel={t('retry')} onRetry={() => void sources.refetch()} />
      ) : !sources.isLoading && rows.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="h-9 pe-3 text-start font-medium">{t('colSource')}</th>
                <NumHead>{t('colImported')}</NumHead>
                <NumHead>{t('colGraded')}</NumHead>
                <NumHead>{t('colLinked')}</NumHead>
                <NumHead>{t('colPublic')}</NumHead>
                <th scope="col" className="h-9 w-48 ps-4 text-start font-medium">{t('colShare')}</th>
              </tr>
            </thead>
            <tbody>
              {sources.isLoading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <tr key={index} className="h-10 border-b border-border/60">
                      <td colSpan={6}><Skeleton className="h-3.5 w-full" /></td>
                    </tr>
                  ))
                : rows.map((source) => (
                    <LedgerRow
                      key={source.id}
                      source={source}
                      locale={locale}
                      notApplicable={t('notApplicable')}
                      errorLabel={t('countError')}
                      graded={countsById.get(source.id)?.graded}
                      unlinked={countsById.get(source.id)?.unlinked}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NumHead({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="h-9 px-3 text-end font-medium whitespace-nowrap">{children}</th>;
}

function LedgerRow({
  source,
  locale,
  notApplicable,
  errorLabel,
  graded,
  unlinked,
}: {
  source: CatalogSource;
  locale: string;
  notApplicable: string;
  errorLabel: string;
  graded?: CountCell;
  unlinked?: CountCell;
}) {
  const empty = source.quoteCount === 0;
  const share = empty ? 0 : source.publishedQuoteCount / source.quoteCount;
  const linked: CountCell | undefined = unlinked && {
    ...unlinked,
    data: unlinked.data === undefined ? undefined : source.quoteCount - unlinked.data,
  };

  return (
    <tr className={cn('h-10 border-b border-border/60', empty && 'text-muted-foreground')}>
      <td className="pe-3">
        <Link
          href={`/admin/quotes?sourceId=${source.id}`}
          className="flex min-w-0 items-baseline gap-2 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate font-medium">{sourceName(source, locale)}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{adminLabel('sourceType', source.type, locale)}</span>
        </Link>
      </td>
      <NumCell value={source.quoteCount} />
      {source.type === 'QURAN' || empty ? (
        <td className="px-3 text-end text-xs text-muted-foreground">{empty ? '—' : notApplicable}</td>
      ) : (
        <AsyncNumCell cell={graded} errorLabel={errorLabel} />
      )}
      {empty ? <td className="px-3 text-end text-muted-foreground">—</td> : <AsyncNumCell cell={linked} errorLabel={errorLabel} />}
      <NumCell value={source.publishedQuoteCount} strong />
      <td className="ps-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full origin-right rounded-full bg-primary ltr:origin-left"
              style={{ transform: `scaleX(${share})` }}
            />
          </div>
          <span className="w-10 text-end text-xs text-muted-foreground tabular-nums">
            {empty ? '—' : `${formatCount(Math.round(share * 100))}%`}
          </span>
        </div>
      </td>
    </tr>
  );
}

function NumCell({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <td className={cn('px-3 text-end tabular-nums', strong && 'font-medium text-foreground')}>
      {formatCount(value)}
    </td>
  );
}

function AsyncNumCell({ cell, errorLabel }: { cell?: CountCell; errorLabel: string }) {
  if (!cell || cell.isLoading) {
    return (
      <td className="px-3">
        <Skeleton className="ms-auto h-3.5 w-12" />
      </td>
    );
  }
  if (cell.isError || cell.data === undefined) {
    return <td className="px-3 text-end text-xs text-destructive" title={errorLabel}>—</td>;
  }
  return <td className="px-3 text-end text-muted-foreground tabular-nums">{formatCount(cell.data)}</td>;
}
