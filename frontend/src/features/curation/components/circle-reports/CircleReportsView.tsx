'use client';

/**
 * CircleReportsView — «بلاغات الصحبة» (round 8, B5; owner decision Q7).
 * What members reported (a member or a message, with the words as they were at report time), why, and when.
 * One action: «تمّت المعالجة». Nothing is removed or blocked from here; the owner decides outside the list.
 */

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { formatDigits } from '@/lib/format/digits';
import type { CircleReportDto, CircleReportStatusFilter } from '@/lib/types/admin';
import { useCircleReports, useSetCircleReportStatus } from '../../hooks/useAdminCircleReports';
import { PageHeader } from '../kit/PageHeader';
import { StatusBadge } from '../kit/StatusBadge';
import { formatCount } from '../kit/format';
import { MessageSnapshot } from './MessageSnapshot';

function formatDate(iso: string, locale: string): string {
  return formatDigits(
    new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }),
  );
}

export function CircleReportsView() {
  const t = useTranslations('admin.circleReports');
  const tTable = useTranslations('admin.table');
  const [status, setStatus] = useState<CircleReportStatusFilter>('open');
  const list = useCircleReports(status);
  const setReportStatus = useSetCircleReportStatus();

  const pages = list.data?.pages ?? [];
  const rows = pages.flatMap((page) => page.data);
  const counts = pages[0]?.counts;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={status}
        onValueChange={(value) => value && setStatus(value as CircleReportStatusFilter)}
        className="self-start"
      >
        <ToggleGroupItem value="open" className="gap-2 px-3">
          {t('tabOpen')}
          <span className="text-xs text-muted-foreground tabular-nums">{counts ? formatCount(counts.open) : ''}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="handled" className="gap-2 px-3">
          {t('tabHandled')}
          <span className="text-xs text-muted-foreground tabular-nums">{counts ? formatCount(counts.handled) : ''}</span>
        </ToggleGroupItem>
      </ToggleGroup>

      {list.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState message={t('loadError')} retryLabel={tTable('retry')} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState message={status === 'open' ? t('emptyOpen') : t('emptyHandled')} />
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t('title')}>
          {rows.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              busy={setReportStatus.isPending}
              onToggle={() => setReportStatus.mutate({ id: report.id, status: report.status === 'open' ? 'handled' : 'open' })}
            />
          ))}
        </ul>
      )}

      {list.hasNextPage ? (
        <Button variant="outline" className="self-center" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {t('more')}
        </Button>
      ) : null}
    </div>
  );
}

function ReportCard({ report, busy, onToggle }: { report: CircleReportDto; busy: boolean; onToggle: () => void }) {
  const t = useTranslations('admin.circleReports');
  const locale = useLocale();
  const handled = report.status === 'handled';

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <StatusBadge
            tone={handled ? 'quiet' : report.reason === 'harassment' || report.reason === 'offensive' ? 'danger' : 'caution'}
            label={t(`reasons.${report.reason}`)}
            size="md"
          />
          <span className="text-sm text-muted-foreground">{report.kind === 'member' ? t('kindMember') : t('kindMessage')}</span>
          {report.reportsAboutSame > 1 ? (
            <span className="text-sm text-destructive">{t('sameAccount', { count: formatCount(report.reportsAboutSame) })}</span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{formatDate(report.createdAt, locale)}</span>
      </div>

      {report.message ? <MessageSnapshot snapshot={report.message.snapshot} /> : null}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Fact label={t('circle')} value={report.circle.name || '—'} />
        <Fact
          label={t('reported')}
          value={report.reported.name}
          hint={report.reported.stillMember ? t('stillMember') : t('leftCircle')}
        />
        <Fact label={t('reporter')} value={report.reporter.name} />
      </dl>

      {report.note ? (
        <p className="max-w-prose text-sm text-pretty">
          <span className="font-medium text-muted-foreground">{t('note')}: </span>
          <span dir="auto">{report.note}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
        <span className="text-xs text-muted-foreground">
          {handled && report.handledAt ? t('handledOn', { date: formatDate(report.handledAt, locale) }) : ''}
        </span>
        <Button variant="outline" size="sm" className="desk-press" disabled={busy} onClick={onToggle}>
          {handled ? t('reopen') : t('handle')}
        </Button>
      </div>
    </li>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words" dir="auto">
        {value}
        {hint ? <span className="ms-2 text-xs font-normal text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  );
}
