'use client';

import { useMemo } from 'react';
import { Waves } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { activePrograms, programCounters, type Store } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { formatDigits } from '@/lib/format/digits';
import { setMomentSource } from '@/lib/practice/local-store';
import { programView } from '@/lib/practice/programs';
import type { PracticeCatalog } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { useSinNames } from '../hooks/useSinNames';

const LEAVE_SIN_HREF = '/practice/leave-sin';

interface HabitProgramsProps {
  store: Store;
  today: string;
  catalog: PracticeCatalog | undefined;
}

/**
 * «ترك المعاصي» in «عاداتي» (owner, 2026-11-01: «عاداتي» holds doing good and leaving sins). Each active «تخفَّف»
 * program as one row: its name, stage and held days, a stage bar, and one action: «سجّل يومك» until today's check-in
 * is saved, then «افتح البرنامج». The program page stays the place for the check-in itself. Local only: the sin list
 * is the same public request for every visitor, and the link never names the sin (roadmap §0.2).
 */
export function HabitPrograms({ store, today, catalog }: HabitProgramsProps) {
  const t = useTranslations('practice.programs');
  const tLeave = useTranslations('leaveSin');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const sins = useSinNames(locale);
  const names = useMemo(
    () => new Map((sins.data ?? []).map((sin) => [sin.slug, locale === 'en' ? sin.name || sin.nameAr : sin.nameAr])),
    [sins.data, locale],
  );
  const programs = activePrograms(store.programs);

  return (
    <section aria-labelledby="programs-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="programs-title" className="text-2xl font-medium">
          {t('title')}
        </h2>
        {programs.length > 0 ? (
          <Link href={`${LEAVE_SIN_HREF}/moment`} className="outline-button" onClick={() => setMomentSource(null)}>
            <Waves aria-hidden />
            {tLeave('moment.open')}
          </Link>
        ) : null}
      </div>

      {programs.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border p-4 md:p-5">
          <p className="text-muted-foreground">{t('empty')}</p>
          <Link href={LEAVE_SIN_HREF} className="outline-button">
            {t('start')} <DirectionalArrow />
          </Link>
        </div>
      ) : null}

      {programs.length > 0 && sins.isError ? <QueryErrorState error={sins.error} onRetry={() => void sins.refetch()} className="py-4" /> : null}

      {programs.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {programs.map((program) => {
            const view = programView(program, today);
            const counters = programCounters(program, today);
            const stage = catalog?.sinPrograms.common.stages[view.stage];
            const name = names.get(program.sinSlug);
            const titleId = `program-row-${program.sinSlug}`;
            const checkedIn = view.today !== null;
            return (
              <li
                key={program.sinSlug}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 md:items-center md:gap-4 md:p-5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <h3
                    id={titleId}
                    className="text-lg font-medium md:text-xl"
                    lang={name && locale === 'en' && /[؀-ۿ]/.test(name) ? 'ar' : undefined}
                  >
                    {name ?? tLeave('program.unnamed')}
                  </h3>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {tLeave('program.stageOf', { n: formatDigits(view.stageIndex + 1), total: formatDigits(view.stageCount) })}
                    {stage ? <>: {locale === 'en' ? stage.titleEn : stage.titleAr}</> : null}
                    {' · '}
                    {tLeave('counters.held', { n: formatDigits(counters.held), total: formatDigits(counters.window) })}
                  </p>
                  <StageBar index={view.stageIndex} count={view.stageCount} />
                </div>
                <Link
                  href={LEAVE_SIN_HREF}
                  className={cn(checkedIn ? 'outline-button' : 'solid-button', 'shrink-0')}
                  aria-describedby={titleId}
                >
                  {checkedIn ? t('open') : t('checkIn')} <DirectionalArrow />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/** The stages as a short bar (decorative: the line above says «المرحلة n من m»); done and current filled. */
function StageBar({ index, count }: { index: number; count: number }) {
  return (
    <span aria-hidden className="flex max-w-56 gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= index ? 'bg-primary' : 'bg-border')} />
      ))}
    </span>
  );
}
