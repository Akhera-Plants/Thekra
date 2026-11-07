'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { LockKeyhole, ShieldCheck, Waves } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { activePrograms, limits, programEntryFor, type SinProgram } from '@thekra/practice-core';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { InfoTip } from '@/components/shared/InfoTip';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { pendingProgramForSession, setMomentSource, updateStore } from '@/lib/practice/local-store';
import { setVaultSession } from '@/lib/practice/vault-flow';
import { Link } from '@/i18n/navigation';
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
import { CreateCodeForm, ForgotCode, UnlockForm } from './VaultForms';

const noSubscribe = () => () => {};
const serverPending = () => null;

/**
 * «تخفَّف» (owner, 2026-11-01: any sin can start it; always kept in the account, encrypted, so the server cannot read
 * the sin). The page opens with the privacy code once per tab (docs/plan/2026-11-01-sin-vault-always-on.md §2–3); the
 * first program asks for a new code before it starts (§1). Each running program is one tab, and each program's own
 * parts are tabs inside it. Every request is the same for every member (catalog, the whole sin list, all evidence).
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
  const [tab, setTab] = useState<string | null>(null);
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

  const privacyLine = (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-7 text-muted-foreground">
      <ShieldCheck className="size-4 shrink-0 text-primary-text" aria-hidden />
      <span>{t('privacyShort')}</span>
      <InfoTip>{t('privacy')}</InfoTip>
      {session ? <SaveStatus /> : null}
    </p>
  );

  // Locked: the code opens «تخفَّف» for this tab; changes made elsewhere on this device are merged in.
  if (vault.data && !session) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        {privacyLine}
        <section aria-labelledby="vault-locked" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <h2 id="vault-locked" className="flex items-center gap-2 text-xl font-medium">
            <LockKeyhole className="size-5 text-primary-text" aria-hidden />
            {t('vault.lockedTitle')}
          </h2>
          <p className="text-muted-foreground">{t('vault.lockedLead')}</p>
          <UnlockForm programs={snapshot.store.programs} userId={userId} onMissing={() => void vault.refetch()} />
          <ForgotCode userId={userId} />
        </section>
      </div>
    );
  }

  const { common, programs: entries } = catalog.data.sinPrograms;
  // A sin without a written program runs the common one, with the category the member gave when starting it.
  const active = activePrograms(snapshot.store.programs).flatMap((program) => {
    const entry = programEntryFor(entries, program.sinSlug, program.category);
    return entry ? [{ program, entry }] : [];
  });

  // Programs made on this device before «تخفَّف» was always encrypted: protect them with a code first.
  if (!vault.data && active.length > 0) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        {privacyLine}
        <section aria-labelledby="vault-create" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <h2 id="vault-create" className="text-xl font-medium">
            {t('vault.protectTitle')}
          </h2>
          <CreateCodeForm
            programs={snapshot.store.programs}
            userId={userId}
            onCreated={() => undefined}
            onExists={() => void vault.refetch()}
          />
        </section>
      </div>
    );
  }

  const preselectNew =
    preselected && names.has(preselected) && !active.some((a) => a.program.sinSlug === preselected) ? preselected : null;
  // Up to 3 programs, each running one at least 60 days before another starts (practice-core `limits`).
  const programLimits = limits(snapshot.store, clock.today);
  const canStart = active.length === 0 || programLimits.canAdd('program');
  const showChooser = active.length === 0 || (canStart && (choosing ?? preselectNew !== null));
  const shownTab = active.some((a) => a.program.sinSlug === tab) ? (tab as string) : (active[0]?.program.sinSlug ?? '');

  function start(program: SinProgram) {
    if (!session) {
      setPending(program);
      return;
    }
    updateStore((store) => ({ ...store, programs: [...store.programs.filter((p) => p.sinSlug !== program.sinSlug), program] }));
    setChoosing(false);
    setTab(program.sinSlug);
  }

  const panel = ({ program, entry }: (typeof active)[number]) => (
    <ProgramPanel
      program={program}
      entry={entry}
      common={common}
      name={names.get(program.sinSlug)}
      habits={habits}
      quotes={evidence.data ?? []}
      today={clock.today}
    />
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {privacyLine}
        {active.length > 0 ? (
          <Link href="/practice/leave-sin/moment" className="outline-button button-wrap" onClick={() => setMomentSource(null)}>
            <Waves aria-hidden />
            {t('moment.open')}
          </Link>
        ) : null}
      </div>

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
        ) : active.length === 1 && active[0] ? (
          panel(active[0])
        ) : (
          <SegmentTabs
            aria-label={t('programsLabel')}
            items={active.map(({ program }) => ({ value: program.sinSlug, label: names.get(program.sinSlug) ?? t('program.unnamed') }))}
            value={shownTab}
            onValueChange={setTab}
            className="gap-6"
          >
            {active.map((item) => (
              <SegmentTabsContent key={item.program.sinSlug} value={item.program.sinSlug}>
                {panel(item)}
              </SegmentTabsContent>
            ))}
          </SegmentTabs>
        )}
      </div>

      {!showChooser && active.length < names.size ? (
        <button type="button" className="outline-button button-wrap self-start" onClick={() => setChoosing(true)}>
          {t('another')}
        </button>
      ) : null}

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
                setTab(pending.sinSlug);
                setPending(null);
                setChoosing(false);
              }}
              onCancel={() => setPending(null)}
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

/** «محفوظ مشفّرًا» while unlocked, the save in progress or its failure, and «أقفل». */
function SaveStatus() {
  const t = useTranslations('leaveSin.vault');
  const state = useVaultSaveState();
  return (
    <>
      <span aria-live="polite" className={state === 'error' || state === 'reopen' ? 'text-destructive' : undefined}>
        ·{' '}
        {state === 'saving'
          ? t('saving')
          : state === 'error'
            ? t('errors.save')
            : state === 'reopen'
              ? t('errors.reopen')
              : t('savedShort')}
      </span>
      {state === 'saving' ? <BrandLoader label={t('saving')} /> : null}
      <button type="button" className="outline-button px-3 text-sm" onClick={() => setVaultSession(null)}>
        <LockKeyhole aria-hidden />
        {t('lock')}
      </button>
    </>
  );
}
