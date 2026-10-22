'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState } from '@/components/shared/ErrorState';
import { adminLabel } from '@/lib/format/admin-labels';
import { formatDigits } from '@/lib/format/digits';
import { splitMatn } from '@/lib/format/isnad';
import type { FlagDto, HadithMatchDto } from '@/lib/types/admin';
import { useFlagAction, useFlagDetail, usePublicState } from '../../hooks/useAdminReview';
import { buildTrail } from '../../lib/trail';
import { ProvenanceTrail } from '../kit/ProvenanceTrail';
import { DECISION_TONE, FLAG_STATUS_TONE, StatusBadge } from '../kit/StatusBadge';
import { useTrailLabels } from '../kit/useTrailLabels';

export interface FlagFolioProps {
  flag: FlagDto;
  onSettled: () => void;
}

/** The opened flag: «مسار النص», our text beside the Sahihayn candidates, and the verdict. */
export function FlagFolio({ flag, onSettled }: FlagFolioProps) {
  const t = useTranslations('admin.flagsDesk');
  const tTrail = useTranslations('admin.trail');
  const tTable = useTranslations('admin.table');
  const locale = useLocale();
  const detail = useFlagDetail(flag.id);
  const publicState = usePublicState(flag.quoteId);
  const action = useFlagAction();
  const trailLabels = useTrailLabels();
  const [note, setNote] = useState('');

  if (detail.isError) {
    return <ErrorState message={t('loadDetail')} retryLabel={tTable('retry')} onRetry={() => void detail.refetch()} className="py-8" />;
  }

  const quote = detail.data?.data.quote ?? flag.quote;
  const matches = detail.data?.data.quote.matches ?? [];
  const isOpen = flag.status === 'OPEN';
  const { matn, stripped } = splitMatn(quote.textAr);
  const isnad = stripped ? quote.textAr.slice(0, quote.textAr.indexOf(matn)).trim() : '';
  const run = (payload: Parameters<typeof action.mutate>[0]) =>
    action.mutate(payload, { onSuccess: () => { setNote(''); onSettled(); } });

  const steps = buildTrail(
    {
      type: 'HADITH',
      source: quote.source,
      gradeAuthority: quote.gradeAuthority,
      gradeReference: quote.gradeReference,
      grade: quote.grade,
      gradeSource: quote.gradeSource,
      openHighFlag: isOpen && flag.severity === 'HIGH',
    },
    publicState.isLoading ? 'loading' : (publicState.data ?? 'unknown'),
    tTrail,
    locale,
  );

  return (
    <div className="flex flex-col gap-6 pt-3">
      <ProvenanceTrail steps={steps} labels={trailLabels} density="panel" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby={`our-${flag.id}`} className="flex min-w-0 flex-col gap-2">
          <h3 id={`our-${flag.id}`} className="text-xs font-medium text-muted-foreground">{t('ourText')}</h3>
          <p dir="rtl" lang="ar" className="font-arabic-text text-lg leading-loose text-pretty">
            {isnad ? <span className="text-muted-foreground">{isnad} </span> : null}
            {matn}
          </p>
          {detail.data?.data.quote.legacyGradeAuthority &&
          detail.data.data.quote.legacyGradeAuthority !== quote.gradeAuthority ? (
            <p className="text-xs text-muted-foreground">
              {t('legacy')}: {detail.data.data.quote.legacyGradeAuthority}{' '}
              {formatDigits(detail.data.data.quote.legacyGradeReference ?? '')}
            </p>
          ) : null}
        </section>

        <section aria-labelledby={`cand-${flag.id}`} className="flex min-w-0 flex-col gap-2">
          <h3 id={`cand-${flag.id}`} className="text-xs font-medium text-muted-foreground">{t('candidates')}</h3>
          {detail.isLoading ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : matches.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              {t('noCandidates')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {matches.map((match) => (
                <Candidate
                  key={match.id}
                  match={match}
                  locale={locale}
                  pending={action.isPending}
                  onConfirm={() => run({ kind: 'confirm', matchId: match.id, note })}
                  onReject={() => run({ kind: 'reject', matchId: match.id, note })}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {isOpen ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <label className="flex min-w-64 flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
            {t('note')}
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={1}
              className="min-h-9 resize-y text-sm"
            />
          </label>
          <Button
            className="desk-press"
            disabled={action.isPending}
            onClick={() => run({ kind: 'resolve', flagId: flag.id, note })}
          >
            {t('resolve')}
          </Button>
          <Button
            variant="ghost"
            className="desk-press"
            disabled={action.isPending}
            onClick={() => run({ kind: 'dismiss', flagId: flag.id, note })}
          >
            {t('dismiss')}
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
          <StatusBadge tone={FLAG_STATUS_TONE[flag.status]} label={adminLabel('flagStatus', flag.status, locale)} size="md" />
          {flag.note ?? t('closed')}
        </p>
      )}
    </div>
  );
}

function Candidate({
  match,
  locale,
  pending,
  onConfirm,
  onReject,
}: {
  match: HadithMatchDto;
  locale: string;
  pending: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const t = useTranslations('admin.flagsDesk');
  const ref = match.referenceHadith;
  const where = [ref.kitab, ref.bab].filter(Boolean).join(' › ');
  const decided = match.decision !== 'CANDIDATE';

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {t('candidate', { book: adminLabel('referenceBook', ref.book, locale), number: formatDigits(ref.number) })}
        </span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          {t('score', { score: `\u2066${formatDigits(Math.round(match.score * 100))}%\u2069` })}
          <StatusBadge
            label={adminLabel('decision', match.decision, locale)}
            tone={DECISION_TONE[match.decision]}
          />
        </span>
      </div>
      {where ? <p className="truncate text-xs text-muted-foreground" dir="rtl" lang="ar">{where}</p> : null}
      <p dir="rtl" lang="ar" className="font-arabic-text text-base leading-loose text-pretty">{ref.matnText}</p>
      {!decided ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="desk-press" disabled={pending} onClick={onConfirm}>
            {t('confirm')}
          </Button>
          <Button size="sm" variant="ghost" className="desk-press" disabled={pending} onClick={onReject}>
            {t('reject')}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
