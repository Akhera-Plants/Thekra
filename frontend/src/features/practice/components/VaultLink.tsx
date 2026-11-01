'use client';

import type { SinProgram } from '@thekra/practice-core';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useVaultAutosave } from '../hooks/useVaultAutosave';

/**
 * One line on «تخفَّف» for the encrypted copy, which lives in Settings now (owner, 2026-11-01). It keeps re-sealing
 * after each check-in while the copy is unlocked in this tab, and says so when that fails.
 */
export function VaultLink({ programs }: { programs: readonly SinProgram[] }) {
  const t = useTranslations('leaveSin.vault');
  const { userId, vault, session, saveState } = useVaultAutosave(programs);
  if (!userId || vault.isPending || vault.isError) return null;
  const href = { pathname: '/settings', hash: 'vault' };
  if (saveState === 'error' || saveState === 'reopen') {
    return (
      <Link href={href} className="text-link text-destructive" role="alert">
        {saveState === 'reopen' ? t('errors.reopen') : t('errors.save')}
      </Link>
    );
  }
  if (session) return <span>· {t('linkOn')}</span>;
  return (
    <Link href={href} className="text-link">
      {vault.data ? t('linkLocked') : t('linkOff')}
    </Link>
  );
}
