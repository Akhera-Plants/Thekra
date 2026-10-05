'use client';

/**
 * QuoteListView — admin quote list with filters.
 * Filters: origin, type, unlinkedOnly, missingTranslation, q (search).
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAdminQuotes, useAdminDeleteQuote } from '../hooks/useAdminQuotes';
import { AdminDataTable, type ColumnDef } from './AdminDataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArabicText } from '@/components/shared/ArabicText';
import { GradeBadge } from '@/components/shared/quote/GradeBadge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { QuoteDto } from '@/lib/types/api';
import type { AdminQuotesQuery } from '@/lib/types/admin';
import { QuoteOrigin, QuoteType } from '@/lib/types/enums';
import { cn } from '@/lib/utils';

const ORIGIN_OPTIONS = [
  { value: 'all', label: 'All origins' },
  { value: QuoteOrigin.LOCAL, label: 'Local' },
  { value: QuoteOrigin.API_CACHED, label: 'API Cached' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: QuoteType.QURAN_VERSE, label: 'Quran verse' },
  { value: QuoteType.HADITH, label: 'Hadith' },
  { value: QuoteType.SCHOLAR_QUOTE, label: 'Scholar quote' },
  { value: QuoteType.BOOK_EXCERPT, label: 'Book excerpt' },
];

export function QuoteListView() {
  const t = useTranslations('admin');
  const [query, setQuery] = useState<AdminQuotesQuery>({ page: 1, limit: 50 });
  const [search, setSearch] = useState('');
  const [, startTransition] = useTransition();

  const { data, isLoading } = useAdminQuotes(query);
  const { mutate: deleteQuote, isPending: isDeleting } = useAdminDeleteQuote();

  function handleSearch(value: string) {
    setSearch(value);
    startTransition(() => {
      setQuery((q) => ({ ...q, q: value || undefined, page: 1 }));
    });
  }

  function handleOriginChange(value: string) {
    setQuery((q) => ({
      ...q,
      origin: value === 'all' ? undefined : (value as QuoteDto['origin']),
      page: 1,
    }));
  }

  function handleTypeChange(value: string) {
    setQuery((q) => ({
      ...q,
      type: value === 'all' ? undefined : [value as QuoteDto['type']],
      page: 1,
    }));
  }

  function handleUnlinkedChange(value: string) {
    setQuery((q) => ({
      ...q,
      unlinkedOnly: value === 'yes' ? true : undefined,
      page: 1,
    }));
  }

  const columns: ColumnDef<QuoteDto>[] = [
    {
      key: 'text',
      header: t('quotes.colText'),
      cell: (row) => (
        <ArabicText as="p" size="sm" className="line-clamp-2 max-w-xs">
          {row.textAr}
        </ArabicText>
      ),
    },
    {
      key: 'type',
      header: t('quotes.colType'),
      cell: (row) => (
        <Badge variant="outline" className="whitespace-nowrap text-xs">
          {row.type}
        </Badge>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'origin',
      header: t('quotes.colOrigin'),
      cell: (row) => (
        <Badge
          variant={row.origin === QuoteOrigin.LOCAL ? 'default' : 'secondary'}
          className="whitespace-nowrap text-xs"
        >
          {row.origin}
        </Badge>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'grade',
      header: t('quotes.colGrade'),
      cell: (row) =>
        row.hadith?.grade ? (
          <GradeBadge grade={row.hadith.grade} label={row.hadith.grade} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'source',
      header: t('quotes.colSource'),
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{row.source.name}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href={`/admin/quotes/${row.id}`} aria-label={t('common.edit')}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={t('common.delete')}
            disabled={isDeleting || row.origin === QuoteOrigin.API_CACHED}
            onClick={() => {
              if (window.confirm(t('common.confirmDelete'))) {
                deleteQuote(row.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      ),
      className: 'w-20',
    },
  ];

  const quotes = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('quotes.title')}</h1>
        <Button asChild size="sm">
          <Link href="/admin/quotes/new">
            <Plus className="me-2 h-4 w-4" aria-hidden />
            {t('quotes.newQuote')}
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t('quotes.searchPlaceholder')}
          className="w-48"
          aria-label={t('quotes.searchPlaceholder')}
        />

        <Select defaultValue="all" onValueChange={handleOriginChange}>
          <SelectTrigger className="w-36" aria-label={t('quotes.filterOrigin')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORIGIN_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select defaultValue="all" onValueChange={handleTypeChange}>
          <SelectTrigger className="w-36" aria-label={t('quotes.filterType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select defaultValue="no" onValueChange={handleUnlinkedChange}>
          <SelectTrigger className="w-40" aria-label={t('quotes.filterUnlinked')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no">{t('quotes.filterUnlinkedAll')}</SelectItem>
            <SelectItem value="yes">{t('quotes.filterUnlinkedOnly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {meta && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t('common.showing', { count: quotes.length, total: meta.total })}
        </p>
      )}

      <AdminDataTable
        columns={columns}
        data={quotes}
        isLoading={isLoading}
        emptyMessage={t('quotes.empty')}
        rowKey={(r) => r.id}
      />

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className={cn('flex items-center gap-2', 'justify-end')}>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page === 1}
            onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
          >
            {t('common.prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {query.page} / {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasNext}
            onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
