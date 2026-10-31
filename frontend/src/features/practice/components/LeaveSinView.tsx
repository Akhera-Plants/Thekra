'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Button } from '@/components/shared/kit/button';
import { accountsEnabled } from '@/lib/accounts';
import { deleteSinVault } from '@/lib/api/practice-me';
import { reportFailure } from '@/lib/errors';
import { pendingProgramForSession, wipeSinPrograms } from '@/lib/practice/local-store';
import { setVaultSession } from '@/lib/practice/vault-flow';
import { queryKeys } from '@/lib/query-keys';
import { allProgramEvidenceIds } from '@/lib/practice/programs';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeEvidence } from '../hooks/usePracticeEvidence';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useSinNames } from '../hooks/useSinNames';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { useSinVault } from '../hooks/useSinVault';
import { useToday } from '../hooks/useToday';
import { LocalOnlyNote } from './LocalOnlyNote';
import { VaultPanel } from './VaultPanel';
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
          <span>{accountsEnabled() ? t('privacy') : t('privacyLocal')}</span>
        </p>
        {snapshot.persistent ? null : <LocalOnlyNote persistent={false} />}
      </div>

      <VaultPanel programs={snapshot.store.programs} />

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
        <button type="button" className="outline-button button-wrap self-start" onClick={() => setChoosing(true)}>
          {t('another')}
        </button>
      ) : null}

      <WipeAll hasPrograms={snapshot.store.programs.length > 0} />
    </div>
  );
}

interface WipeAllProps {
  hasPrograms: boolean;
}

/** «احذف كل بيانات البرنامج»: this device at once, and the encrypted copy in the account when there is one. */
function WipeAll({ hasPrograms }: WipeAllProps) {
  const t = useTranslations('leaveSin.wipe');
  const queryClient = useQueryClient();
  const { userId, vault } = useSinVault();
  const [remoteFailed, setRemoteFailed] = useState(false);
  const hasVault = Boolean(vault.data);
  if (!hasPrograms && !hasVault && !remoteFailed) return null;

  async function removeRemote() {
    if (!userId) return;
    try {
      await deleteSinVault();
      setRemoteFailed(false);
    } catch (error) {
      reportFailure('sin vault delete', error);
      setRemoteFailed(true);
    } finally {
      void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
    }
  }

  function handleConfirm() {
    wipeSinPrograms();
    setVaultSession(null);
    // Signed in: also delete the vault, even when it was never opened here (it may hold this program).
    if (userId) void removeRemote();
  }

  return (
    <section className="flex flex-col items-start gap-2 border-t border-border pt-6" aria-labelledby="wipe-title">
      <h2 id="wipe-title" className="text-xl font-medium">
        {t('title')}
      </h2>
      <p className="text-sm leading-7 text-muted-foreground">{userId ? t('leadAccount') : t('lead')}</p>
      {remoteFailed ? (
        <div className="flex flex-col items-start gap-2" role="alert">
          <p className="text-sm text-destructive">{t('remoteFailed')}</p>
          <Button variant="outline" tone="primary" size="sm" onClick={() => void removeRemote()}>
            <RefreshCw aria-hidden />
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {hasPrograms || hasVault ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button" className="outline-button button-wrap">
              {t('button')}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{userId ? t('confirmBodyAccount') : t('confirmBody')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm}>{t('confirm')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </section>
  );
}
