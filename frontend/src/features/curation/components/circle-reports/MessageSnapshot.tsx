'use client';

import { useTranslations } from 'next-intl';
import type { CircleMessageSnapshot } from '@/lib/types/admin';
import { formatCount } from '../kit/format';

/**
 * What the reported message said when it was reported. A suggested line is shown in its words (by key);
 * a round shows its kind, its short label (the one free text a member can write) and the minutes.
 */
export function MessageSnapshot({ snapshot }: { snapshot: CircleMessageSnapshot | null }) {
  const t = useTranslations('admin.circleReports');
  if (!snapshot) return <p className="text-sm text-muted-foreground">{t('snapshotGone')}</p>;

  const round = snapshot.round;
  const roundKind = round?.kind && t.has(`roundKinds.${round.kind}`) ? t(`roundKinds.${round.kind}`) : (round?.kind ?? '');
  const lineKey = snapshot.key ?? '';
  let line: string | null = null;
  if (snapshot.kind === 'PRESET' || snapshot.kind === 'REPLY') {
    const base = snapshot.kind === 'REPLY' ? `replies.${lineKey}` : `lines.${lineKey}`;
    if (lineKey === 'progress' && snapshot.data?.total) {
      line = t('lines.progress', { done: formatCount(snapshot.data.done ?? 0), total: formatCount(snapshot.data.total) });
    } else if (t.has(base)) {
      line = t(base);
    } else {
      line = lineKey || null;
    }
  } else if (snapshot.kind === 'ROUND_START') {
    line = t('roundStart', { kind: roundKind, minutes: formatCount(round?.minutes ?? 0) });
  } else if (snapshot.kind === 'ROUND_END') {
    line = t('roundEnd', { kind: roundKind, outcome: round?.outcome === 'DONE' ? t('outcomeDone') : t('outcomeNotDone') });
  }

  return (
    <figure className="flex flex-col gap-1 rounded-lg border-s-2 border-border bg-muted/40 px-3 py-2">
      <figcaption className="text-xs text-muted-foreground">{t('messageHeading')}</figcaption>
      <blockquote dir="rtl" lang="ar" className="text-base text-pretty">
        {line ?? '—'}
      </blockquote>
      {round?.label ? (
        <p className="text-sm">
          <span className="text-muted-foreground">{t('roundLabel')}: </span>
          <bdi dir="auto" className="font-medium">{round.label}</bdi>
        </p>
      ) : null}
    </figure>
  );
}
