'use client';

import { useState } from 'react';
import { Check, LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/shared/kit/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { setVaultSession } from '@/lib/practice/vault-flow';
import { cn } from '@/lib/utils';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useSinVault } from '../hooks/useSinVault';
import { ForgotCode, UnlockForm } from './VaultForms';

/**
 * The lock state of «تخفَّف» (owner round 6, C-15: «بدل اقفل تكون مقفل وجنبها صح وخلص! واذا ضغط عليها يطلعله بوب اب
 * الغاء القفل»): locked → «مقفل ✓», a tap opens the unlock popup (privacy code, «نسيت الرمز؟»); open → «أقفل». Nothing
 * for an account without a vault. Never says where the programs are kept («محفوظ مشفّرًا» is gone).
 */
export function VaultLockState({ className, onUnlocked }: { className?: string; onUnlocked?: () => void }) {
  const t = useTranslations('leaveSin.vault');
  const snapshot = usePracticeStore();
  const { userId, vault, session } = useSinVault();
  const [open, setOpen] = useState(false);
  if (!userId || !snapshot || !vault.data) return null;

  if (session) {
    return (
      <Button
        variant="outline"
        tone="neutral"
        size="sm"
        icon={<LockKeyhole aria-hidden />}
        className={className}
        onClick={() => {
          setVaultSession(null);
          toast.success(t('lockedToast'));
        }}
      >
        {t('lock')}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        tone="primary"
        size="sm"
        aria-haspopup="dialog"
        aria-label={t('lockedState')}
        icon={<Check aria-hidden />}
        iconPosition="end"
        className={cn(className)}
        onClick={() => setOpen(true)}
      >
        {t('locked')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{t('lockedTitle')}</DialogTitle>
            <DialogDescription className="leading-7">{t('lockedLead')}</DialogDescription>
          </DialogHeader>
          <UnlockForm
            programs={snapshot.store.programs}
            userId={userId}
            onOpened={() => {
              setOpen(false);
              onUnlocked?.();
            }}
            onMissing={() => {
              setOpen(false);
              void vault.refetch();
            }}
          />
          <ForgotCode userId={userId} />
        </DialogContent>
      </Dialog>
    </>
  );
}
