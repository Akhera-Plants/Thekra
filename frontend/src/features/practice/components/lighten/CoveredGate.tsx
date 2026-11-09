'use client';

import { useState, type ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { activePrograms, isLightenCovered, type SinProgram, type Store } from '@thekra/practice-core';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useSinVault } from '../../hooks/useSinVault';
import { UnlockForm } from '../VaultForms';

interface CoveredGateProps {
  store: Store;
  /** What shows once the programs are open (never rendered before). */
  children: (programs: SinProgram[]) => ReactNode;
  /** A row in a list (`li`), or a block. */
  as?: 'row' | 'block';
  className?: string;
}

/**
 * «تخفَّف» as a COVERED habit (round 6 §2, C-02e): a neutral row that names nothing. A tap asks the privacy code (the
 * web's fingerprint / PIN) and only then renders the programs; this happens on every visit while the member keeps the
 * covering on (`settings.lightenCovered`, the default; he may turn it off in the settings). With the covering off, an
 * open vault shows the programs directly; a locked vault still asks the code. Never blurred text. Nothing shows for a
 * member without programs.
 */
export function CoveredGate({ store, children, as = 'row', className }: CoveredGateProps) {
  const t = useTranslations('practice.covered');
  const { userId, vault, session } = useSinVault();
  const [revealed, setRevealed] = useState(false);
  const [asking, setAsking] = useState(false);
  const programs = activePrograms(store.programs);
  const hasVault = Boolean(vault.data);
  if (!userId || (!hasVault && programs.length === 0)) return null;
  const covered = isLightenCovered(store);
  const open = session !== null && (revealed || !covered);
  if (open) return <>{children(programs)}</>;

  const Shell = as === 'row' ? 'li' : 'div';
  return (
    <Shell className={className}>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={cn(
          'group flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start transition-colors duration-150 hover:bg-muted',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          as === 'block' && 'border border-border bg-card px-4',
        )}
      >
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <LockKeyhole className="size-[1.125rem]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base leading-7 font-medium">{t('title')}</span>
          <span className="text-sm leading-6 text-muted-foreground">{session ? t('coveredHint') : t('lockedHint')}</span>
        </span>
        <DirectionalArrow className="size-4 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
      </button>
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{t('askTitle')}</DialogTitle>
            <DialogDescription className="leading-7">{t('askLead')}</DialogDescription>
          </DialogHeader>
          {asking && userId ? (
            <UnlockForm
              programs={store.programs}
              userId={userId}
              onOpened={() => {
                setRevealed(true);
                setAsking(false);
              }}
              onMissing={() => void vault.refetch()}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
