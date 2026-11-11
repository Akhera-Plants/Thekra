'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Check, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { activePrograms, limits, programEntryFor, type SinProgram } from '@thekra/practice-core';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { Button } from '@/components/shared/kit/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { pendingProgramForSession, updateStore } from '@/lib/practice/local-store';
import { cn } from '@/lib/utils';
import { allProgramEvidenceIds } from '@/lib/practice/programs';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeEvidence } from '../hooks/usePracticeEvidence';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useSinNames } from '../hooks/useSinNames';
import { useSinVault } from '../hooks/useSinVault';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { useToday } from '../hooks/useToday';
import { useVaultSaveState } from '../hooks/useVaultAutosave';
import { PracticeLoading } from './PracticeLoading';
import { LimitSheet } from './LimitSheet';
import { ProgramChooser } from './ProgramChooser';
import { ProgramPanel } from './ProgramPanel';
import { CreateCodeForm } from './VaultForms';
import { VaultLockState } from './VaultLockState';

const noSubscribe = () => () => {};
const serverPending = () => null;

/**
 * «تخفَّف» (owner, 2026-11-01: any sin can start it; always kept in the account, encrypted, so the server cannot read
 * the sin). The page opens with the privacy code once per tab (docs/plan/2026-11-01-sin-vault-always-on.md §2–3); the
 * first program offers a new code before it starts (§1) — optional since round 7 (C6): «تخطَّ وابدأ» keeps the program on
 * this device only (never sent unencrypted) until a code is set from its «⋯ › الخصوصية والإخفاء». Round 5 (F-11 a / A-21 a), as in the app: ONE program is
 * shown at a time, its name a selectable title that switches between the running programs (and starts another), then
 * its one tab bar «اليوم · رحلتي» (ProgramPanel). Round 6 (C-15): no privacy line; the lock state is «أقفل» / «مقفل ✓»
 * (a tap on the latter opens the unlock popup); the sin list of the chooser is searchable. Every
 * request is the same for every member (catalog, the whole sin list, all evidence).
 */
export function LeaveSinView() {
  const t = useTranslations('leaveSin');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const snapshot = usePracticeStore();
  const clock = useToday();
  const catalog = usePracticeCatalog();
  const sins = useSinNames(locale);
  const { userId, sessionLoading, vault, session } = useSinVault();
  const evidenceIds = useMemo(() => (catalog.data ? allProgramEvidenceIds(catalog.data.sinPrograms) : []), [catalog.data]);
  const evidence = usePracticeEvidence(evidenceIds, Boolean(catalog.data));
  const preselected = useSyncExternalStore(noSubscribe, pendingProgramForSession, serverPending);
  /** null until the member opens or closes the chooser: a sin page's hand-off opens it even beside other programs. */
  const [choosing, setChoosing] = useState<boolean | null>(null);
  /** A program waiting for the first privacy code. */
  const [pending, setPending] = useState<SinProgram | null>(null);
  /** The program shown when several run (chosen from the title's dialog). */
  const [focus, setFocus] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [ended, setEnded] = useState(false);
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

  if (!snapshot || !clock || catalog.isPending || sins.isPending || sessionLoading || !userId || vault.isPending) {
    return <PracticeLoading />;
  }
  if (catalog.isError || sins.isError || vault.isError) {
    return (
      <QueryErrorState
        error={catalog.error ?? sins.error ?? vault.error}
        onRetry={() => {
          void catalog.refetch();
          void sins.refetch();
          void vault.refetch();
        }}
      />
    );
  }

  // Round 6 (C-15): no «محفوظ مشفّرًا في حسابك» line. While open, a quiet save status and «أقفل»; locked, «مقفل ✓»
  // (VaultLockState), whose tap opens the unlock popup.
  const lockRow = vault.data ? (
    <div className="flex min-h-11 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm text-muted-foreground">
      {session ? <SaveStatus /> : null}
      <VaultLockState />
    </div>
  ) : null;

  if (vault.data && !session) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <p className="text-base leading-8 text-muted-foreground">{t('vault.lockedNote')}</p>
        <VaultLockState className="self-start" />
      </div>
    );
  }

  const { common, programs: entries } = catalog.data.sinPrograms;
  // A sin without a written program runs the common one, with the category the member gave when starting it.
  const active = activePrograms(snapshot.store.programs).flatMap((program) => {
    const entry = programEntryFor(entries, program.sinSlug, program.category);
    return entry ? [{ program, entry }] : [];
  });

  // Round 7 (C6): programs without a privacy code (skipped, or made before «تخفَّف» was encrypted) run as they are, on
  // this device only; the code is set later from the program's «⋯ › الخصوصية والإخفاء».

  const preselectNew =
    preselected && names.has(preselected) && !active.some((a) => a.program.sinSlug === preselected) ? preselected : null;
  // Up to 3 programs, each running one at least 60 days before another starts (practice-core `limits`).
  const programLimits = limits(snapshot.store, clock.today);
  const canStart = active.length === 0 || programLimits.canAdd('program');
  const showChooser = active.length === 0 || (canStart && (choosing ?? preselectNew !== null));
  const current = active.find((a) => a.program.sinSlug === focus) ?? active[0];
  const canAddAnother = active.length < names.size;

  /** Starts a program: kept on this device, and sealed into the account when a privacy code is open in this tab. */
  function begin(program: SinProgram) {
    updateStore((store) => ({ ...store, programs: [...store.programs.filter((p) => p.sinSlug !== program.sinSlug), program] }));
    setChoosing(false);
    setEnded(false);
    setFocus(program.sinSlug);
  }

  function start(program: SinProgram) {
    // No vault yet: the privacy code is offered first, and can be skipped (round 7, C6). A program started without it
    // stays on this device only: practice-core never syncs programs unencrypted.
    if (!session && !vault.data) {
      setPending(program);
      return;
    }
    begin(program);
  }


  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {lockRow}
      {ended ? (
        <p className="next-step !mt-0 flex items-start gap-2" role="status">
          <Check className="mt-1.5 size-4 shrink-0 text-primary-text" aria-hidden />
          <span>{t('endedNote')}</span>
        </p>
      ) : null}

      {evidence.isError ? <QueryErrorState error={evidence.error} onRetry={() => void evidence.refetch()} className="py-4" /> : null}

      <div ref={contentRef} tabIndex={-1} className="flex flex-col gap-8 focus:outline-none">
        {showChooser ? (
          <ProgramChooser
            entries={entries}
            common={common}
            sins={sins.data}
            names={names}
            preselected={preselectNew}
            today={clock.today}
            onDone={() => setChoosing(false)}
            onStart={start}
            onCancel={active.length > 0 ? () => setChoosing(false) : undefined}
          />
        ) : current ? (
          <ProgramPanel
            key={current.program.sinSlug}
            program={current.program}
            entry={current.entry}
            common={common}
            name={names.get(current.program.sinSlug)}
            habits={habits}
            quotes={evidence.data ?? []}
            today={clock.today}
            onSwitch={() => setSwitching(true)}
            onEnded={() => {
              setFocus(null);
              setChoosing(null);
              setEnded(true);
            }}
          />
        ) : null}
      </div>

      {/* The program's name opens this: the running programs (one is shown), and «ابدأ برنامجًا آخر». */}
      <Dialog open={switching} onOpenChange={setSwitching}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('program.switchTitle')}</DialogTitle>
          </DialogHeader>
          <div role="radiogroup" aria-label={t('program.switchTitle')} className="flex flex-col divide-y divide-border">
            {active.map(({ program }) => {
              const on = program.sinSlug === current?.program.sinSlug;
              return (
                <button
                  key={program.sinSlug}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setFocus(program.sinSlug);
                    setSwitching(false);
                  }}
                  className="flex min-h-14 items-center gap-3 py-2 text-start transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {on ? <Check className="size-3" /> : null}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{names.get(program.sinSlug) ?? t('program.unnamed')}</span>
                    <span className="text-sm text-muted-foreground">
                      {program.category === 'haqq_ibad' ? t('program.categoryIbad') : t('program.categoryAllah')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {canAddAnother ? (
            <Button
              variant="outline"
              tone="primary"
              size="md"
              icon={<Plus aria-hidden />}
              onClick={() => {
                setSwitching(false);
                setChoosing(true);
              }}
            >
              {t('another')}
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={pending !== null} onOpenChange={(open) => (open ? undefined : setPending(null))}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('vault.createTitle')}</DialogTitle>
            <DialogDescription>{t('vault.createLead')}</DialogDescription>
          </DialogHeader>
          {pending ? (
            <CreateCodeForm
              programs={[...snapshot.store.programs.filter((p) => p.sinSlug !== pending.sinSlug), pending]}
              userId={userId}
              onCreated={(sealed) => {
                updateStore((store) => ({ ...store, programs: [...sealed] }));
                setFocus(pending.sinSlug);
                setEnded(false);
                setPending(null);
                setChoosing(false);
              }}
              onSkip={() => {
                begin(pending);
                setPending(null);
              }}
              onExists={() => {
                setPending(null);
                void vault.refetch();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <LimitSheet
        kind="program"
        open={choosing === true && !canStart}
        onOpenChange={(open) => (open ? undefined : setChoosing(false))}
        limits={programLimits}
        store={snapshot.store}
        habits={new Map()}
        today={clock.today}
      />
    </div>
  );
}

/** The save in progress or its failure (quiet while saved). */
function SaveStatus() {
  const t = useTranslations('leaveSin.vault');
  const state = useVaultSaveState();
  return (
    <>
      <span aria-live="polite" className={state === 'error' || state === 'reopen' ? 'text-destructive' : undefined}>
        {state === 'saving' ? t('saving') : state === 'error' ? t('errors.save') : state === 'reopen' ? t('errors.reopen') : null}
      </span>
      {state === 'saving' ? <BrandLoader label={t('saving')} /> : null}
    </>
  );
}
