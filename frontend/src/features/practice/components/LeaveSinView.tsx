'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { pendingProgramForSession, wipeSinPrograms } from '@/lib/practice/local-store';
import { allProgramEvidenceIds } from '@/lib/practice/programs';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeEvidence } from '../hooks/usePracticeEvidence';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useSinNames } from '../hooks/useSinNames';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { useToday } from '../hooks/useToday';
import { LocalOnlyNote } from './LocalOnlyNote';
import { PracticeLoading } from './PracticeLoading';
import { ProgramChooser } from './ProgramChooser';
import { ProgramPanel } from './ProgramPanel';

const noSubscribe = () => () => {};
const serverPending = () => null;

/**
 * «ترك المعصية». LOCAL ONLY: the chosen program, check-ins and notes stay in this browser. Every request
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
  const [choosing, setChoosing] = useState(false);
  const programCount = snapshot?.store.programs.length ?? 0;
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
  const active = snapshot.store.programs.flatMap((program) => {
    const entry = entries.find((e) => e.sin === program.sinSlug);
    return entry ? [{ program, entry }] : [];
  });
  const showChooser = active.length === 0 || choosing;
  const preselectNew = preselected && !active.some((a) => a.program.sinSlug === preselected) ? preselected : null;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <p className="flex items-start gap-2 leading-8">
          <ShieldCheck className="mt-1.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>{t('privacy')}</span>
        </p>
        <LocalOnlyNote persistent={snapshot.persistent} />
      </div>

      <div ref={contentRef} tabIndex={-1} className="flex flex-col gap-10 focus:outline-none">
        {showChooser ? (
          <ProgramChooser
            entries={entries}
            common={common}
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

      {!showChooser && active.length < entries.length ? (
        <button type="button" className="outline-button self-start" onClick={() => setChoosing(true)}>
          {t('another')}
        </button>
      ) : null}

      {snapshot.store.programs.length > 0 ? <WipeAll /> : null}
    </div>
  );
}

function WipeAll() {
  const t = useTranslations('leaveSin.wipe');
  return (
    <section className="flex flex-col items-start gap-2 border-t border-border pt-6" aria-labelledby="wipe-title">
      <h2 id="wipe-title" className="text-xl font-medium">
        {t('title')}
      </h2>
      <p className="text-sm leading-7 text-muted-foreground">{t('lead')}</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className="outline-button">
            {t('button')}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={wipeSinPrograms}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
