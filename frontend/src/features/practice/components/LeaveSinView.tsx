'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { ShieldCheck, Waves } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { activePrograms, limits, programEntryFor } from '@thekra/practice-core';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { InfoTip } from '@/components/shared/InfoTip';
import { pendingProgramForSession, setMomentSource } from '@/lib/practice/local-store';
import { Link } from '@/i18n/navigation';
import { allProgramEvidenceIds } from '@/lib/practice/programs';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeEvidence } from '../hooks/usePracticeEvidence';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useSinNames } from '../hooks/useSinNames';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { useToday } from '../hooks/useToday';
import { LocalOnlyNote } from './LocalOnlyNote';
import { VaultLink } from './VaultLink';
import { PracticeLoading } from './PracticeLoading';
import { LimitSheet } from './LimitSheet';
import { ProgramChooser } from './ProgramChooser';
import { ProgramPanel } from './ProgramPanel';

const noSubscribe = () => () => {};
const serverPending = () => null;

/**
 * «تخفَّف» (owner, 2026-11-01: any sin can start it; the encrypted copy is a setting now, linked in one line). LOCAL ONLY: the chosen program, check-ins and notes stay in this browser. Every request
 * this page makes (catalog, the whole sin list, all programs' evidence) is the same for every visitor.
 */
export function LeaveSinView() {
  const t = useTranslations('leaveSin');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const snapshot = usePracticeStore();
  const clock = useToday();
  const catalog = usePracticeCatalog();
  const sins = useSinNames(locale);
  const evidenceIds = useMemo(() => (catalog.data ? allProgramEvidenceIds(catalog.data.sinPrograms) : []), [catalog.data]);
  const evidence = usePracticeEvidence(evidenceIds, Boolean(catalog.data));
  const preselected = useSyncExternalStore(noSubscribe, pendingProgramForSession, serverPending);
  /** null until the visitor opens or closes the chooser: a sin page's hand-off opens it even beside other programs. */
  const [choosing, setChoosing] = useState<boolean | null>(null);
  const programCount = snapshot ? activePrograms(snapshot.store.programs).length : 0;
  const contentRef = useFocusOnChange<HTMLDivElement>(`${choosing}-${programCount}`);

  const names = useMemo(
    () => new Map((sins.data ?? []).map((sin) => [sin.slug, locale === 'en' ? sin.name || sin.nameAr : sin.nameAr])),
    [sins.data, locale],
  );
  const habits = useMemo(
    () => new Map<string, PracticeHabit>((catalog.data?.habits ?? []).map((h) => [h.key, h])),
    [catalog.data],
  );

  if (!snapshot || !clock || catalog.isPending || sins.isPending) return <PracticeLoading />;
  if (catalog.isError || sins.isError) {
    return (
      <QueryErrorState
        error={catalog.error ?? sins.error}
        onRetry={() => {
          void catalog.refetch();
          void sins.refetch();
        }}
      />
    );
  }

  const { common, programs: entries } = catalog.data.sinPrograms;
  // A sin without a written program runs the common one, with the category the visitor gave when starting it.
  const active = activePrograms(snapshot.store.programs).flatMap((program) => {
    const entry = programEntryFor(entries, program.sinSlug, program.category);
    return entry ? [{ program, entry }] : [];
  });
  const preselectNew =
    preselected && names.has(preselected) && !active.some((a) => a.program.sinSlug === preselected) ? preselected : null;
  // One «تخفَّف» program until it reaches its last stage (practice-core `limits`).
  const programLimits = limits(snapshot.store, clock.today);
  const canStart = active.length === 0 || programLimits.canAdd('program');
  const showChooser = active.length === 0 || (canStart && (choosing ?? preselectNew !== null));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-7 text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
          <span>{t('privacyShort')}</span>
          <InfoTip>{t('privacy')}</InfoTip>
          <VaultLink programs={snapshot.store.programs} />
        </p>
        {snapshot.persistent ? null : <LocalOnlyNote persistent={false} />}
      </div>

      {active.length > 0 ? (
        <Link
          href="/practice/leave-sin/moment"
          className="outline-button button-wrap self-start"
          onClick={() => setMomentSource(null)}
        >
          <Waves aria-hidden />
          {t('moment.open')}
        </Link>
      ) : null}

      <div ref={contentRef} tabIndex={-1} className="flex flex-col gap-10 focus:outline-none">
        {showChooser ? (
          <ProgramChooser
            entries={entries}
            common={common}
            sins={sins.data}
            names={names}
            preselected={preselectNew}
            today={clock.today}
            onDone={() => setChoosing(false)}
            onCancel={active.length > 0 ? () => setChoosing(false) : undefined}
          />
        ) : null}

        {!showChooser
          ? active.map(({ program, entry }) => (
              <div key={program.sinSlug} className="flex flex-col gap-4">
                {evidence.isError ? (
                  <QueryErrorState error={evidence.error} onRetry={() => void evidence.refetch()} className="py-4" />
                ) : null}
                <ProgramPanel
                  program={program}
                  entry={entry}
                  common={common}
                  name={names.get(program.sinSlug)}
                  habits={habits}
                  quotes={evidence.data ?? []}
                  today={clock.today}
                />
              </div>
            ))
          : null}
      </div>

      {!showChooser && active.length < names.size ? (
        <button type="button" className="outline-button button-wrap self-start" onClick={() => setChoosing(true)}>
          {t('another')}
        </button>
      ) : null}
      <LimitSheet
        kind="program"
        open={choosing === true && !canStart}
        onOpenChange={(open) => (open ? undefined : setChoosing(false))}
        limits={programLimits}
        habits={new Map()}
        today={clock.today}
      />
    </div>
  );
}
