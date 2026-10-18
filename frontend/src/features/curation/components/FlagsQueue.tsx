'use client';

/**
 * FlagsQueue — triage desk for QuoteFlags.
 * Rail: severity / type / status / book with faceted counts (one limit=1 request per value).
 * Table: severity dot, Arabic type, book, the matn's first line (isnad folded for display).
 * Row opens the folio: «مسار النص», candidates side by side, resolve/dismiss/confirm/reject.
 * Keyboard: j / k move, Enter opens, Esc closes.
 */

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { countFlags } from '@/lib/api/admin-review';
import { getCatalogSources } from '@/lib/api/sources';
import {
  adminLabel,
  FLAG_SEVERITIES,
  FLAG_STATUSES,
  FLAG_TYPES,
  sourceName,
  type FlagSeverity,
  type FlagStatus,
  type FlagType,
} from '@/lib/format/admin-labels';
import { splitMatn } from '@/lib/format/isnad';
import { queryKeys } from '@/lib/query-keys';
import type { FlagDto, FlagsQuery } from '@/lib/types/admin';
import { useFacetCounts, useFlags } from '../hooks/useAdminReview';
import { useUrlState } from '../hooks/useUrlState';
import { DataTable, TablePager, type DataColumn } from './kit/DataTable';
import { FilterRail, type FilterGroup } from './kit/FilterRail';
import { PageHeader } from './kit/PageHeader';
import { FLAG_STATUS_TONE, SEVERITY_TONE, StatusBadge } from './kit/StatusBadge';
import { formatAge, formatCount } from './kit/format';
import { FlagFolio } from './flags/FlagFolio';

const PAGE_SIZE = 50;
const URL_KEYS = ['severity', 'type', 'status', 'book', 'page'] as const;

export function FlagsQueue() {
  const t = useTranslations('admin.flagsDesk');
  const tTable = useTranslations('admin.table');
  const tHome = useTranslations('admin.home');
  const locale = useLocale();
  const [url, setUrl] = useUrlState(URL_KEYS);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  // status: absent = OPEN (the queue), "ALL" = every status
  const status = url.status === 'ALL' ? undefined : ((url.status as FlagStatus | null) ?? 'OPEN');
  const filters: Omit<FlagsQuery, 'page' | 'limit'> = {
    status,
    severity: (url.severity as FlagSeverity | null) ?? undefined,
    type: (url.type as FlagType | null) ?? undefined,
    sourceId: url.book ?? undefined,
  };
  const page = Number(url.page ?? '1') || 1;
  const list = useFlags({ ...filters, page, limit: PAGE_SIZE });

  const sources = useQuery({
    queryKey: [...queryKeys.sources.list({ limit: 100 }), 'catalog'],
    queryFn: () => getCatalogSources({ limit: 100 }),
  });
  const bookIds = useMemo(() => (sources.data?.data ?? []).map((s) => s.id), [sources.data]);

  // Each facet counts under every *other* active filter.
  const severityCounts = useFacetCounts('flags', FLAG_SEVERITIES, (v) => ({ ...filters, severity: v as FlagSeverity }), countFlags);
  const typeCounts = useFacetCounts('flags', FLAG_TYPES, (v) => ({ ...filters, type: v as FlagType }), countFlags);
  const statusCounts = useFacetCounts('flags', FLAG_STATUSES, (v) => ({ ...filters, status: v as FlagStatus }), countFlags);
  const bookCounts = useFacetCounts('flags', bookIds, (v) => ({ ...filters, sourceId: v }), countFlags);

  const select = (patch: Partial<Record<(typeof URL_KEYS)[number], string | null>>) => {
    setExpanded(null);
    setActive(null);
    setUrl({ ...patch, page: null });
  };

  const groups: FilterGroup[] = [
    {
      id: 'severity',
      label: t('facetSeverity'),
      selected: filters.severity ?? null,
      onSelect: (value) => select({ severity: value }),
      countsLoading: severityCounts.isLoading,
      countsError: severityCounts.isError,
      options: FLAG_SEVERITIES.map((value) => ({
        value,
        label: adminLabel('severity', value, locale),
        count: severityCounts.counts[value],
        tone: SEVERITY_TONE[value],
      })),
    },
    {
      id: 'status',
      label: t('facetStatus'),
      selected: status ?? null,
      onSelect: (value) => select({ status: value === 'OPEN' ? null : (value ?? 'ALL') }),
      countsLoading: statusCounts.isLoading,
      countsError: statusCounts.isError,
      options: FLAG_STATUSES.map((value) => ({
        value,
        label: adminLabel('flagStatus', value, locale),
        count: statusCounts.counts[value],
        tone: FLAG_STATUS_TONE[value],
      })),
    },
    {
      id: 'type',
      label: t('facetType'),
      selected: filters.type ?? null,
      onSelect: (value) => select({ type: value }),
      countsLoading: typeCounts.isLoading,
      countsError: typeCounts.isError,
      hideEmpty: true,
      options: FLAG_TYPES.map((value) => ({
        value,
        label: adminLabel('flagType', value, locale),
        count: typeCounts.counts[value],
      })),
    },
    {
      id: 'book',
      label: t('facetBook'),
      selected: filters.sourceId ?? null,
      onSelect: (value) => select({ book: value }),
      countsLoading: bookCounts.isLoading,
      countsError: bookCounts.isError,
      hideEmpty: true,
      options: (sources.data?.data ?? []).map((source) => ({
        value: source.id,
        label: sourceName(source, locale),
        count: bookCounts.counts[source.id],
      })),
    },
  ];

  const columns: DataColumn<FlagDto>[] = [
    {
      id: 'severity',
      header: t('colSeverity'),
      className: 'w-24 whitespace-nowrap',
      cell: (row) => <StatusBadge tone={SEVERITY_TONE[row.severity]} label={adminLabel('severity', row.severity, locale)} />,
    },
    {
      id: 'type',
      header: t('colType'),
      className: 'w-40 whitespace-nowrap text-foreground/85',
      cell: (row) => adminLabel('flagType', row.type, locale),
    },
    {
      id: 'book',
      header: t('colBook'),
      className: 'w-48 max-w-48',
      cell: (row) => <span className="block truncate text-muted-foreground">{sourceName(row.quote.source, locale)}</span>,
    },
    {
      id: 'matn',
      header: t('colText'),
      className: 'w-full max-w-0',
      cell: (row) => (
        <span dir="rtl" lang="ar" className="block truncate font-arabic-text text-base">
          {splitMatn(row.quote.textAr).matn}
        </span>
      ),
    },
    {
      id: 'age',
      header: t('colDate'),
      className: 'w-20 whitespace-nowrap text-xs text-muted-foreground',
      cell: (row) => formatAge(row.createdAt, locale),
    },
  ];

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        meta={meta ? t('total', { count: formatCount(meta.total) }) : undefined}
      />
      <div className="flex items-start gap-6">
        <FilterRail
          className="hidden lg:flex"
          groups={groups}
          labels={{ title: tTable('filters'), any: tTable('any'), clear: tTable('clearFilters'), countError: tHome('countError') }}
          onClearAll={() => select({ severity: null, type: null, status: null, book: null })}
        />
        <DataTable
          className="min-w-0 flex-1"
          caption={t('title')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          rowTone={(row) => (row.severity === 'HIGH' && row.status === 'OPEN' ? 'danger' : 'none')}
          isLoading={list.isLoading}
          isError={list.isError}
          onRetry={() => void list.refetch()}
          labels={{ expand: tTable('expand'), collapse: tTable('collapse'), empty: t('empty'), error: t('error'), retry: tTable('retry') }}
          keyboard
          activeKey={active}
          onActiveChange={setActive}
          expandedKey={expanded}
          onExpandedChange={setExpanded}
          renderExpanded={(row) => <FlagFolio flag={row} onSettled={() => setExpanded(null)} />}
          footer={
            meta ? (
              <TablePager
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                onPageChange={(next) => {
                  setExpanded(null);
                  setUrl({ page: String(next) });
                }}
                hint={<span className="hidden md:inline">{tTable('keyboard')}</span>}
                labels={{
                  prev: tTable('prev'),
                  next: tTable('next'),
                  page: (p, total) => tTable('page', { page: p, total }),
                  rows: (count) => t('total', { count }),
                }}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}
