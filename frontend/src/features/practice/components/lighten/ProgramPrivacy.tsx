'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { isLightenCovered, setLightenCovered } from '@thekra/practice-core';
import { Switch } from '@/components/shared/kit/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { updateStore } from '@/lib/practice/local-store';
import { usePracticeStore } from '../../hooks/usePracticeStore';
import { useSinVault } from '../../hooks/useSinVault';
import { CreateCodeForm } from '../VaultForms';

/**
 * «الخصوصية والإخفاء» of a «تخفَّف» program (owner round 7, C6: «تعديل لاحقًا إني أخفيها من مكان صحيح جوا العادة
 * نفسها»), opened from the program's «⋯»:
 * - no privacy code yet: the program is on this device only; «احفظ الرمز» seals it into the account (practice-core
 *   vault) and from then on it is covered in «عاداتي» and «سجلّي» (the default of `settings.lightenCovered`);
 * - with a code: the same covering switch as in the settings, here where the program is.
 */
export function ProgramPrivacyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('leaveSin.privacy');
  const snapshot = usePracticeStore();
  const { userId, vault } = useSinVault();
  const labelId = useId();
  const hintId = useId();
  if (!snapshot || !userId) return null;
  const noCode = vault.isSuccess && vault.data === null;
  const covered = isLightenCovered(snapshot.store);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="pe-8">
          <DialogTitle className="leading-8">{t('title')}</DialogTitle>
          <DialogDescription className="leading-7">{noCode ? t('noCode') : t('withCode')}</DialogDescription>
        </DialogHeader>
        {noCode ? (
          <CreateCodeForm
            programs={snapshot.store.programs}
            userId={userId}
            submitLabel={t('saveCode')}
            onCreated={() => {
              toast.success(t('saved'));
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
            onExists={() => {
              onOpenChange(false);
              void vault.refetch();
            }}
          />
        ) : (
          <div className="flex min-h-16 items-center gap-3 rounded-xl border border-border px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span id={labelId} className="text-base">
                {t('coverLabel')}
              </span>
              <span id={hintId} className="text-sm leading-6 text-muted-foreground">
                {t('coverHint')}
              </span>
            </span>
            <Switch
              aria-labelledby={labelId}
              aria-describedby={hintId}
              checked={covered}
              onCheckedChange={(on) => {
                updateStore((store) => setLightenCovered(store, on));
                toast.success(on ? t('coverOn') : t('coverOff'));
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
