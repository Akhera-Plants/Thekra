'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        footer={
          meta ? (
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
          ) : null
        }
      />
    </div>
  );
}
