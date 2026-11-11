'use client';

/**
 * LinkConcernsView — «روابط بلا علاقة» (round 8, B5).
 * Links the content team flagged «لا علاقة حقيقية» while linking. Kind, topic and decision live in the URL.
 * «أبقِ الربط» accepts the link and clears the flag; «اخفِ الربط» rejects it (readers stop seeing it) and keeps the flag,
 * so a hidden link sits in «أُخفيت» until the owner changes his mind. Nothing is deleted.
 */

import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Link } from '@/i18n/navigation';
import { splitMatn } from '@/lib/format/isnad';
import type { LinkConcernDecision, LinkConcernDto, LinkConcernKind } from '@/lib/types/admin';
import { useDecideLinkConcern, useLinkConcerns } from '../../hooks/useAdminLinkConcerns';
import { useUrlState } from '../../hooks/useUrlState';
import { TablePager } from '../kit/DataTable';
import { PageHeader } from '../kit/PageHeader';
import { StatusBadge } from '../kit/StatusBadge';
import { formatCount } from '../kit/format';

const PAGE_SIZE = 50;
const URL_KEYS = ['kind', 'topic', 'decision', 'page'] as const;
const KINDS: LinkConcernKind[] = ['sin', 'good-deed', 'branch'];
const ALL_TOPICS = 'all';

export function LinkConcernsView() {
  const t = useTranslations('admin.linkConcerns');
  const tTable = useTranslations('admin.table');
  const [url, setUrl] = useUrlState(URL_KEYS);
  const kind: LinkConcernKind = KINDS.find((k) => k === url.kind) ?? 'sin';
  const decision: LinkConcernDecision = url.decision === 'hidden' ? 'hidden' : 'pending';
  const topicId = url.topic ?? undefined;
  const page = Math.max(1, Number(url.page ?? '1') || 1);

  const list = useLinkConcerns({ kind, decision, topicId, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE });
  const decide = useDecideLinkConcern();
  const meta = list.data?.meta;
  const rows = list.data?.data ?? [];
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={kind}
            onValueChange={(value) => value && setUrl({ kind: value === 'sin' ? null : value, topic: null, page: null })}
          >
            {KINDS.map((value) => (
              <ToggleGroupItem key={value} value={value} className="gap-2 px-3">
                {t(`kind.${value}`)}
                <span className="text-xs text-muted-foreground tabular-nums">{meta ? formatCount(meta.counts[value]) : ''}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Select
            value={topicId ?? ALL_TOPICS}
            onValueChange={(value) => setUrl({ topic: value === ALL_TOPICS ? null : value, page: null })}
          >
            <SelectTrigger className="w-64 max-w-full" aria-label={t('topicFilter')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TOPICS}>{t('allTopics')}</SelectItem>
              {(meta?.topics ?? []).map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.nameAr} · {formatCount(topic.count)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={decision} onValueChange={(value) => setUrl({ decision: value === 'hidden' ? 'hidden' : null, page: null })}>
          <TabsList variant="line">
            <TabsTrigger value="pending">{t('tabPending')}</TabsTrigger>
            <TabsTrigger value="hidden">{t('tabHidden')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {list.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState message={t('loadError')} retryLabel={tTable('retry')} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState message={decision === 'pending' ? t('emptyPending') : t('emptyHidden')} />
      ) : (
        <ul className="flex flex-col" aria-label={t('title')}>
          {rows.map((row) => (
            <ConcernRow
              key={row.linkId}
              row={row}
              hiddenList={decision === 'hidden'}
              busy={decide.isPending}
              onDecide={(choice) => decide.mutate({ kind: row.kind, linkId: row.linkId, decision: choice })}
            />
          ))}
        </ul>
      )}

      {meta ? (
        <TablePager
          page={page}
          totalPages={totalPages}
          total={meta.total}
          onPageChange={(next) => setUrl({ page: next === 1 ? null : String(next) })}
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

function ConcernRow({
  row,
  hiddenList,
  busy,
  onDecide,
}: {
  row: LinkConcernDto;
  hiddenList: boolean;
  busy: boolean;
  onDecide: (choice: 'keep' | 'hide') => void;
}) {
  const t = useTranslations('admin.linkConcerns');
  const text = splitMatn(row.quote.excerpt).matn || row.quote.excerpt;
  const visible = row.reviewStatus === 'ACCEPTED';

  return (
    <li className="grid gap-x-6 gap-y-3 border-b border-border/70 py-4 md:grid-cols-[11rem_minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-medium text-pretty">{row.topic.nameAr}</span>
        <StatusBadge tone={visible ? 'positive' : 'quiet'} label={visible ? t('visible') : t('notVisible')} />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <p dir="rtl" lang="ar" className="line-clamp-3 font-arabic-text text-base leading-loose text-pretty">
          {text}
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">{t('reason')}: </span>
          {row.concernNote ? <span dir="auto">{row.concernNote}</span> : t('noNote')}
        </p>
        <Link
          href={`/admin/quotes/${row.quote.id}`}
          className="inline-flex w-fit items-center gap-1 rounded-sm text-xs text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink aria-hidden className="size-3" />
          {t('openText')}
        </Link>
      </div>

      <div className="flex items-start gap-2 md:justify-end">
        <Button size="sm" variant="outline" className="desk-press min-w-28 flex-1 md:flex-none" disabled={busy} onClick={() => onDecide('keep')}>
          {t('keep')}
        </Button>
        {hiddenList ? null : (
          <Button size="sm" variant="outline" className="desk-press min-w-28 flex-1 md:flex-none" disabled={busy} onClick={() => onDecide('hide')}>
            {t('hide')}
          </Button>
        )}
      </div>
    </li>
  );
}
