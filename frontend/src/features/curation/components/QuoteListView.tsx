'use client';

/**
 * QuoteListView — the texts table (43k rows): server pagination and filters, URL state,
 * a facet rail with live counts, rows that open into the text and its «مسار النص»,
 * and row actions behind ⋯ (edit first; delete separated and confirmed).
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Link, useRouter } from '@/i18n/navigation';
import { countAdminQuotes } from '@/lib/api/admin-review';
import { getCatalogSources } from '@/lib/api/sources';
import { adminLabel, labelKeys, sourceName } from '@/lib/format/admin-labels';
import { splitMatn } from '@/lib/format/isnad';
import { queryKeys } from '@/lib/query-keys';
import type { AdminQuoteDto, AdminQuotesQuery } from '@/lib/types/admin';
import type { HadithGrade, QuoteOrigin, QuoteType } from '@/lib/types/enums';
import { useFacetCounts } from '../hooks/useAdminReview';
import { useAdminDeleteQuote, useAdminQuotes } from '../hooks/useAdminQuotes';
import { useUrlState } from '../hooks/useUrlState';
import { DataTable, TablePager, type DataColumn } from './kit/DataTable';
import { FilterRail, type FilterGroup } from './kit/FilterRail';
import { PageHeader } from './kit/PageHeader';
import { RowActions } from './kit/RowActions';
import { GRADE_TONE, StatusBadge } from './kit/StatusBadge';
import { formatCount } from './kit/format';
import { QuoteFolio } from './quotes/QuoteFolio';

const PAGE_SIZE = 50;
const URL_KEYS = ['q', 'type', 'grade', 'origin', 'link', 'text', 'sourceId', 'page', 'open'] as const;
const TYPES = labelKeys('quoteType') as QuoteType[];
const GRADES: HadithGrade[] = ['SAHIH', 'HASAN', 'DAIF', 'UNGRADED']; // MAWDU is rejected by the admin list validator
const ORIGINS = labelKeys('origin') as QuoteOrigin[];

type CountQuery = Omit<AdminQuotesQuery, 'page' | 'limit'>;

export function QuoteListView() {
  const t = useTranslations('admin.quotesDesk');
  const tTable = useTranslations('admin.table');
  const tCommon = useTranslations('admin.common');
  const tHome = useTranslations('admin.home');
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const [url, setUrl] = useUrlState(URL_KEYS);
  const [search, setSearch] = useState(url.q ?? '');
  const debounced = useDebouncedValue(search.trim(), 300);
  const [expanded, setExpanded] = useState<string | null>(url.open);
  const [active, setActive] = useState<string | null>(url.open);

  // The URL can change from outside (⌘K → ?q=…&open=…): follow it without clobbering typing.
  const [seen, setSeen] = useState({ q: url.q, open: url.open });
  if (seen.q !== url.q || seen.open !== url.open) {
    setSeen({ q: url.q, open: url.open });
    if (seen.q !== url.q && (url.q ?? '') !== debounced) setSearch(url.q ?? '');
    if (seen.open !== url.open && url.open) {
      setExpanded(url.open);
      setActive(url.open);
    }
  }

  useEffect(() => {
    if ((url.q ?? '') !== debounced) setUrl({ q: debounced || null, page: null, open: null });
    // only react to the settled search text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const filters: CountQuery = {
    q: url.q ?? undefined,
    type: url.type ? [url.type as QuoteType] : undefined,
    grades: url.grade ? [url.grade as HadithGrade] : undefined,
    origin: (url.origin as QuoteOrigin | null) ?? undefined,
    unlinkedOnly: url.link === 'unlinked' ? true : undefined,
    unverifiedOnly: url.text === 'ocr' ? true : undefined,
    sourceId: url.sourceId ?? undefined,
  };
  const page = Number(url.page ?? '1') || 1;
  const list = useAdminQuotes({ ...filters, page, limit: PAGE_SIZE });
  const { mutate: deleteQuote } = useAdminDeleteQuote();

  const sources = useQuery({
    queryKey: [...queryKeys.sources.list({ limit: 100 }), 'catalog'],
    queryFn: () => getCatalogSources({ limit: 100 }),
  });
  const sourceIds = useMemo(() => (sources.data?.data ?? []).map((s) => s.id), [sources.data]);

  // Each facet counts under every *other* active filter.
  const typeCounts = useFacetCounts('quotes', TYPES, (v) => ({ ...filters, type: [v as QuoteType] }), countAdminQuotes);
  const gradeCounts = useFacetCounts('quotes', GRADES, (v) => ({ ...filters, grades: [v as HadithGrade] }), countAdminQuotes);
  const originCounts = useFacetCounts('quotes', ORIGINS, (v) => ({ ...filters, origin: v as QuoteOrigin }), countAdminQuotes);
  const linkCount = useFacetCounts('quotes', ['true'], () => ({ ...filters, unlinkedOnly: true }), countAdminQuotes);
  const ocrCount = useFacetCounts('quotes', ['true'], () => ({ ...filters, unverifiedOnly: true }), countAdminQuotes);
  // Per-source counts only without a text search: 23 full-text counts would cost more than they tell.
  const sourceCounts = useFacetCounts('quotes', filters.q ? [] : sourceIds, (v) => ({ ...filters, sourceId: v }), countAdminQuotes);

  const select = (patch: Partial<Record<(typeof URL_KEYS)[number], string | null>>) => {
    setExpanded(null);
    setActive(null);
    setUrl({ ...patch, page: null, open: null });
  };

  const facet = (
    id: string,
    label: string,
    selected: string | null,
    key: (typeof URL_KEYS)[number],
    counts: ReturnType<typeof useFacetCounts>,
    options: FilterGroup['options'],
    extra: Partial<FilterGroup> = {},
  ): FilterGroup => ({
    id,
    label,
    selected,
    onSelect: (value) => select({ [key]: value }),
    countsLoading: counts.isLoading,
    countsError: counts.isError,
    options,
    ...extra,
  });

  const groups: FilterGroup[] = [
    facet('type', t('facetType'), url.type, 'type', typeCounts,
      TYPES.map((value) => ({ value, label: adminLabel('quoteType', value, locale), count: typeCounts.counts[value] }))),
    facet('grade', t('facetGrade'), url.grade, 'grade', gradeCounts,
      GRADES.map((value) => ({ value, label: adminLabel('grade', value, locale), count: gradeCounts.counts[value], tone: GRADE_TONE[value] }))),
    facet('text', t('facetText'), url.text, 'text', ocrCount,
      [{ value: 'ocr', label: t('ocrUnverified'), count: ocrCount.counts.true, tone: 'caution' }]),
    facet('link', t('facetLink'), url.link, 'link', linkCount,
      [{ value: 'unlinked', label: t('unlinkedOnly'), count: linkCount.counts.true }]),
    facet('origin', t('facetOrigin'), url.origin, 'origin', originCounts,
      ORIGINS.map((value) => ({ value, label: adminLabel('origin', value, locale), count: originCounts.counts[value] }))),
    facet('source', t('facetSource'), url.sourceId, 'sourceId', sourceCounts,
      (sources.data?.data ?? []).map((source) => ({
        value: source.id,
        label: sourceName(source, locale),
        count: filters.q ? undefined : sourceCounts.counts[source.id],
      })),
      { hideEmpty: !filters.q }),
  ];

  const openEditor = (row: AdminQuoteDto) => {
    // Seed the detail cache: the backend has no GET /admin/quotes/:id.
    qc.setQueryData(queryKeys.adminQuotes.detail(row.id), { data: row });
    router.push(`/admin/quotes/${row.id}`);
  };

  const columns: DataColumn<AdminQuoteDto>[] = [
    {
      id: 'grade',
      header: t('colGrade'),
      className: 'w-24 whitespace-nowrap',
      cell: (row) =>
        row.type === 'HADITH' ? (
          <StatusBadge tone={GRADE_TONE[row.hadith?.grade ?? 'UNGRADED']} label={adminLabel('grade', row.hadith?.grade ?? 'UNGRADED', locale)} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { id: 'type', header: t('colType'), className: 'w-24 whitespace-nowrap text-foreground/85', cell: (row) => adminLabel('quoteType', row.type, locale) },
    {
      id: 'source',
      header: t('colSource'),
      className: 'w-48 max-w-48',
      cell: (row) => <span className="block truncate text-muted-foreground">{sourceName(row.source, locale)}</span>,
    },
    {
      id: 'matn',
      header: t('colText'),
      className: 'w-full max-w-0',
      cell: (row) => (
        <span dir="rtl" lang="ar" className="block truncate font-arabic-text text-base">
          {splitMatn(row.textAr).matn}
        </span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tTable('actions')}</span>,
      className: 'w-10',
      cell: (row) => (
        <RowActions
          label={tTable('actions')}
          primary={[{ label: t('edit'), icon: Pencil, onSelect: () => openEditor(row) }]}
          destructive={{
            label: t('delete'),
            icon: Trash2,
            disabled: row.origin === 'API_CACHED',
            disabledReason: t('cachedNoDelete'),
            onSelect: () => deleteQuote(row.id),
            confirmTitle: t('deleteTitle'),
            confirmBody: t('deleteBody'),
            confirmLabel: tCommon('delete'),
            cancelLabel: tCommon('cancel'),
          }}
        />
      ),
    },
  ];

  const rows = (list.data?.data ?? []) as AdminQuoteDto[];
  const meta = list.data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        meta={meta ? t('total', { count: formatCount(meta.total) }) : undefined}
        actions={
          <Button asChild size="sm" className="desk-press">
            <Link href="/admin/quotes/new">
              <Plus data-icon="inline-start" aria-hidden />
              {t('newQuote')}
            </Link>
          </Button>
        }
      />
      <div className="flex items-start gap-6">
        <FilterRail
          className="hidden lg:flex"
          groups={groups}
          labels={{ title: tTable('filters'), any: tTable('any'), clear: tTable('clearFilters'), countError: tHome('countError') }}
          onClearAll={() => {
            setSearch('');
            select({ q: null, type: null, grade: null, origin: null, link: null, text: null, sourceId: null });
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <InputGroup className="h-9">
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              name="q"
              autoComplete="off"
              spellCheck={false}
              dir="auto"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
            />
          </InputGroup>
          <DataTable
            caption={t('title')}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            isLoading={list.isLoading}
            isError={list.isError}
            onRetry={() => void list.refetch()}
            labels={{ expand: tTable('expand'), collapse: tTable('collapse'), empty: t('empty'), error: t('error'), retry: tTable('retry') }}
            keyboard
            activeKey={active}
            onActiveChange={setActive}
            expandedKey={expanded}
            onExpandedChange={setExpanded}
            renderExpanded={(row) => <QuoteFolio quote={row} onEdit={() => openEditor(row)} />}
            footer={
              meta ? (
                <TablePager
                  page={page}
                  totalPages={meta.totalPages}
                  total={meta.total}
                  onPageChange={(next) => {
                    setExpanded(null);
                    setUrl({ page: String(next), open: null });
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
    </div>
  );
}
