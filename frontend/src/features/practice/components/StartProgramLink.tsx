'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { activePrograms } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { setPendingProgram } from '@/lib/practice/local-store';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useSinVault } from '../hooks/useSinVault';
import { VaultLockState } from './VaultLockState';

interface StartProgramLinkProps {
  slug: string;
}

/**
 * The action on a sin page's title line (owner round 6, C-12 / C-15), opposite the sin's name: «تخفَّف من هذه المعصية»,
 * or — when this sin's program already runs on this device — its state: «مقفل ✓» while «تخفَّف» is locked (a tap opens
 * the unlock popup) and «في خطتك» (to the program) once open. No «أنت مشترك» line and no line about encryption. The
 * slug goes through device storage, never the URL, so the browser history records only `/practice/leave-sin`.
 */
export function StartProgramLink({ slug }: StartProgramLinkProps) {
  const t = useTranslations('leaveSin');
  const snapshot = usePracticeStore();
  const { vault, session } = useSinVault();
  const isActive = snapshot ? activePrograms(snapshot.store.programs).some((program) => program.sinSlug === slug) : false;
  if (isActive && vault.data && !session) return <VaultLockState />;
  if (isActive) {
    return (
      <Button asChild variant="outline" tone="primary" size="md">
        <Link href="/practice/leave-sin">
          <Check aria-hidden />
          {t('inPlan')}
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild variant="solid" tone="primary" size="md">
      <Link href="/practice/leave-sin" onClick={() => setPendingProgram(slug)}>
        {t('startFromSin')}
      </Link>
    </Button>
  );
}
