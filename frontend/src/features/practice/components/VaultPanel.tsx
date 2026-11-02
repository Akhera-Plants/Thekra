'use client';

import { useState } from 'react';
import { KeyRound, LockKeyhole, LockKeyholeOpen, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SinProgram } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { setVaultSession } from '@/lib/practice/vault-flow';
import { useSinVault } from '../hooks/useSinVault';
import { useVaultAutosave, useVaultSaveState } from '../hooks/useVaultAutosave';
import { ChangeCodeForm, ForgotCode, UnlockForm } from './VaultForms';

interface VaultPanelProps {
  programs: readonly SinProgram[];
}

/**
 * «تخفَّف» in Settings (owner, 2026-11-01: always encrypted in the account, so the only choices are lock / unlock and
 * changing the privacy code). The first program creates the vault on the «تخفَّف» page. Mounts the autosave, since
 * Settings is outside the practice pages.
 */
export function VaultPanel({ programs }: VaultPanelProps) {
  const t = useTranslations('leaveSin.vault');
  const { userId, sessionLoading, vault, session } = useSinVault();
  const { saveNow } = useVaultAutosave(programs);
  const saveState = useVaultSaveState();
  const [changing, setChanging] = useState(false);

  if (sessionLoading || !userId) return null;
  if (vault.isPending) return <BrandLoader label={t('checking')} showLabel />;
  if (vault.isError) return <QueryErrorState error={vault.error} onRetry={() => void vault.refetch()} className="py-4" />;

  if (!vault.data) {
    return (
      <Box icon={<KeyRound />} title={t('title')}>
        <p className="text-muted-foreground">{t('none')}</p>
      </Box>
    );
  }

  if (session) {
    return (
      <Box icon={<LockKeyholeOpen />} title={t('title')}>
        <p>{t('openNow')}</p>
        {saveState === 'saving' ? <BrandLoader label={t('saving')} showLabel /> : null}
        {saveState === 'error' ? (
          <div className="flex flex-col items-start gap-2" role="alert">
            <p className="text-destructive">{t('errors.save')}</p>
            <Button variant="outline" tone="primary" size="sm" onClick={() => void saveNow()}>
              <RefreshCw aria-hidden />
              {t('retry')}
            </Button>
          </div>
        ) : null}
        {changing ? (
          <ChangeCodeForm session={session} programs={programs} userId={userId} onDone={() => setChanging(false)} />
        ) : (
          <div className="flex flex-wrap gap-3">
            <button type="button" className="outline-button button-wrap" onClick={() => setVaultSession(null)}>
              <LockKeyhole aria-hidden />
              {t('lock')}
            </button>
            <button type="button" className="outline-button button-wrap" onClick={() => setChanging(true)}>
              <KeyRound aria-hidden />
              {t('change')}
            </button>
          </div>
        )}
      </Box>
    );
  }

  return (
    <Box icon={<LockKeyhole />} title={t('title')}>
      {saveState === 'reopen' ? <p className="text-destructive">{t('errors.reopen')}</p> : null}
      <p>{t('lockedLead')}</p>
      <UnlockForm programs={programs} userId={userId} onMissing={() => void vault.refetch()} />
      <ForgotCode userId={userId} />
    </Box>
  );
}

function Box({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section id="vault" className="flex scroll-mt-24 flex-col gap-3 rounded-2xl border border-border bg-card p-5 leading-8" aria-label={title}>
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <span className="text-primary [&_svg]:size-5" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
