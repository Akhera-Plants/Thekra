'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { adminLabel, topicName } from '@/lib/format/admin-labels';
import { formatDigits } from '@/lib/format/digits';
import { splitMatn } from '@/lib/format/isnad';
import type { ProposedLinkDto } from '@/lib/types/admin';
import { useLinkCount, useProposedLinks, useSetLinkReviewStatus } from '../../hooks/useAdminReview';
import { DataTable, TablePager, type DataColumn } from '../kit/DataTable';
import { formatCount } from '../kit/format';

export type ProposalKind = 'sin' | 'good-deed';

export interface ProposalsQueueProps {
  kind: ProposalKind;
  onKindChange: (kind: ProposalKind) => void;
}

/**
 * NOT_REVIEWED links, highest relevance first. Accept/reject PATCH the link's reviewStatus
 * (the update DTOs already accept it). Only ACCEPTED links reach readers.
 */
export function ProposalsQueue({ kind, onKindChange }: ProposalsQueueProps) {
  const t = useTranslations('admin.proposals');
  const tTable = useTranslations('admin.table');
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const list = useProposedLinks(kind, page);
  const sinTotal = useLinkCount('sin', 'NOT_REVIEWED');
  const deedTotal = useLinkCount('good-deed', 'NOT_REVIEWED');
  const decide = useSetLinkReviewStatus(kind);

  const act = (row: ProposedLinkDto, status: 'ACCEPTED' | 'REJECTED') =>
    decide.mutate({ id: row.id, status }, { onSuccess: () => setExpanded(null) });

  const columns: DataColumn<ProposedLinkDto>[] = [
    {
      id: 'topic',
      header: t('colTopic'),
      className: 'w-44 max-w-44',
      cell: (row) => <span className="block truncate font-medium">{topicName(row.sin ?? row.goodDeed, locale)}</span>,
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
      id: 'basis',
      header: t('colBasis'),
      className: 'w-32 whitespace-nowrap text-muted-foreground',
      cell: (row) => adminLabel('basis', row.basis, locale),
    },
    {
      id: 'by',
      header: t('colBy'),
      className: 'w-20 whitespace-nowrap text-muted-foreground',
      cell: (row) => adminLabel('classifiedBy', row.classifiedBy, locale),
    },
    {
      id: 'score',
      header: t('colScore'),
      className: 'w-16 text-end tabular-nums',
      cell: (row) => (row.relevanceScore == null ? '—' : formatDigits(row.relevanceScore)),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tTable('actions')}</span>,
      className: 'w-44 whitespace-nowrap',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" className="desk-press" disabled={decide.isPending} onClick={() => act(row, 'ACCEPTED')}>
            <Check data-icon="inline-start" aria-hidden />
            {t('accept')}
          </Button>
          <Button size="sm" variant="ghost" className="desk-press text-muted-foreground" disabled={decide.isPending} onClick={() => act(row, 'REJECTED')}>
            <X data-icon="inline-start" aria-hidden />
            {t('reject')}
          </Button>
        </div>
      ),
    },
  ];

  const meta = list.data?.meta;

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={kind}
        onValueChange={(value) => {
          if (!value) return;
          setPage(1);
          setExpanded(null);
          onKindChange(value as ProposalKind);
        }}
        className="self-start"
      >
        <ToggleGroupItem value="sin" className="gap-2 px-3">
          {t('kindSin')}
          <span className="text-xs text-muted-foreground tabular-nums">{sinTotal.data === undefined ? '' : formatCount(sinTotal.data)}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="good-deed" className="gap-2 px-3">
          {t('kindDeed')}
          <span className="text-xs text-muted-foreground tabular-nums">{deedTotal.data === undefined ? '' : formatCount(deedTotal.data)}</span>
        </ToggleGroupItem>
      </ToggleGroup>
      <DataTable
        className="hidden md:flex"
        caption={t('title')}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        labels={{ expand: tTable('expand'), collapse: tTable('collapse'), empty: t('empty'), error: t('loadError'), retry: tTable('retry') }}
        keyboard
        activeKey={active}
        onActiveChange={setActive}
        expandedKey={expanded}
        onExpandedChange={setExpanded}
        renderExpanded={(row) => (
          <div className="flex flex-col gap-3 pt-3">
            <p dir="rtl" lang="ar" className="max-w-prose font-arabic-text text-lg leading-loose text-pretty">
              {row.quote.textAr}
            </p>
            {row.note ? (
              <p className="max-w-prose text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">{t('reason')}: </span>
                <span dir="rtl" lang="ar">{formatDigits(row.note)}</span>
              </p>
            ) : null}
          </div>
        )}
      />
      {/* Phone: the table loses its text column and pushes the buttons off screen, so each proposal is a card. */}
      <div className="md:hidden">
        {list.isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState message={t('loadError')} retryLabel={tTable('retry')} onRetry={() => void list.refetch()} />
        ) : (list.data?.data ?? []).length === 0 ? (
          <EmptyState message={t('empty')} />
        ) : (
          <ul className="flex flex-col gap-3" aria-label={t('title')}>
            {(list.data?.data ?? []).map((row) => (
              <ProposalCard key={row.id} row={row} locale={locale} busy={decide.isPending} onAct={(status) => act(row, status)} />
            ))}
          </ul>
        )}
      </div>
      {meta ? (
        <TablePager
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={(next) => {
            setExpanded(null);
            setPage(next);
          }}
          hint={<span className="hidden md:inline">{tTable('keyboard')}</span>}
          labels={{
            prev: tTable('prev'),
            next: tTable('next'),
            page: (p, total) => tTable('page', { page: p, total }),
            rows: (count) => t('total', { count }),
          }}
        />
          ) : null}
    </div>
  );
}

function ProposalCard({
  row,
  locale,
  busy,
  onAct,
}: {
  row: ProposedLinkDto;
  locale: string;
  busy: boolean;
  onAct: (status: 'ACCEPTED' | 'REJECTED') => void;
}) {
  const t = useTranslations('admin.proposals');
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 font-medium text-pretty">{topicName(row.sin ?? row.goodDeed, locale)}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {row.relevanceScore == null ? '' : `${t('colScore')} ${formatDigits(row.relevanceScore)}`}
        </span>
      </div>
      <p dir="rtl" lang="ar" className="line-clamp-5 font-arabic-text text-base leading-loose text-pretty">
        {splitMatn(row.quote.textAr).matn}
      </p>
      {row.note ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">{t('reason')}: </span>
          <span dir="rtl" lang="ar">{formatDigits(row.note)}</span>
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="desk-press" disabled={busy} onClick={() => onAct('ACCEPTED')}>
          <Check data-icon="inline-start" aria-hidden />
          {t('accept')}
        </Button>
        <Button variant="outline" className="desk-press" disabled={busy} onClick={() => onAct('REJECTED')}>
          <X data-icon="inline-start" aria-hidden />
          {t('reject')}
        </Button>
      </div>
    </li>
  );
}
