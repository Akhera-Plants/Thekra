/**
 * Archive and the limit of 3 (owner round 6, owner chat + C-01d; practice-core archive.ts):
 * - {@link ArchiveSheet}: «أرشِف» says plainly what happens — the habit leaves «اليوم» and the count of 3, its history
 *   stays in «سجلّي», and after more than 3 days in the archive its progress starts again. At most 10 in the archive:
 *   beyond that the member deletes one first. There is no second «pause» anywhere: the archive IS the pause.
 * - {@link HabitAddChoiceSheet}: «أضف» with 3 habits: «لديك 3 عادات — أرشِف واحدة أو احذفها» (two buttons) with the
 *   3-day note, then the habit to free; deleting is confirmed in the same sheet.
 * Every change toasts.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Archive, Trash2 } from 'lucide-react-native';
import {
  ARCHIVE_MAX,
  ARCHIVE_RESET_DAYS,
  archivePlan,
  canArchive,
  deletePlan,
  habitAddChoice,
  type LocalDate,
  type Plan,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useAuthStore } from '@/lib/stores/auth-store';
import { planTitleOf } from '@/components/practice/hub/HeartCards';
import { space, useStyles } from '@/theme';
import { BottomSheet, ButtonPair, ListRow, Notice, Text, toast } from '@/ui';

const makeStyles = () => ({
  stack: { gap: space.md },
});

export function ArchiveSheet({ plan, title, today, visible, onClose, onDone }: { plan: Plan | undefined; title: string; today: LocalDate; visible: boolean; onClose: () => void; onDone?: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const full = !canArchive(store);
  return (
    <BottomSheet visible={visible && plan !== undefined} title={t('habitsHub.archive.confirmTitle', { habit: title })} onClose={onClose}>
      <View style={styles.stack}>
        <Text variant="body">{t('habitsHub.archive.confirmBody', { days: ARCHIVE_RESET_DAYS })}</Text>
        {full ? <Notice tone="destructive">{t('habitsHub.archive.full', { max: ARCHIVE_MAX })}</Notice> : null}
        <ButtonPair
          primary={{
            label: t('habitsHub.archive.action'),
            icon: Archive,
            disabled: full,
            onPress: () => {
              if (!plan) return;
              setStore((s) => archivePlan(s, plan.id, today));
              toast(t('habitsHub.archive.doneToast', { habit: title }));
              onClose();
              onDone?.();
            },
          }}
          secondary={{ label: t('common.cancel'), onPress: onClose }}
        />
      </View>
    </BottomSheet>
  );
}

type Step = { kind: 'choose' } | { kind: 'pick'; action: 'archive' | 'delete' } | { kind: 'confirmDelete'; plan: Plan };

/** «أضف» past the limit: archive or delete one of the three (C-01d). `onFreed` continues the add flow. */
export function HabitAddChoiceSheet({ visible, today, onClose, onFreed }: { visible: boolean; today: LocalDate; onClose: () => void; onFreed: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const choice = habitAddChoice(store, today, { isPeriodicAct: (p) => habitFor(p, habits)?.kind === 'periodic' });
  const close = () => {
    setStep({ kind: 'choose' });
    onClose();
  };
  const title = (p: Plan) => planTitleOf(p, habits, locale);
  const freed = () => {
    setStep({ kind: 'choose' });
    onFreed();
  };
  return (
    <BottomSheet visible={visible} title={t('habitsHub.limit.title', { count: choice?.count ?? 3 })} onClose={close}>
      <View style={styles.stack}>
        {step.kind === 'choose' ? (
          <>
            <Text variant="body">{t('habitsHub.limit.body')}</Text>
            <Text variant="small" tone="muted">
              {t('habitsHub.limit.note', { days: choice?.resetDays ?? ARCHIVE_RESET_DAYS })}
            </Text>
            <ButtonPair
              primary={{
                label: t('habitsHub.limit.archive'),
                icon: Archive,
                disabled: !choice?.options.includes('archive'),
                onPress: () => setStep({ kind: 'pick', action: 'archive' }),
              }}
              secondary={{ label: t('habitsHub.limit.delete'), icon: Trash2, onPress: () => setStep({ kind: 'pick', action: 'delete' }) }}
            />
            {choice && !choice.options.includes('archive') ? (
              <Text variant="small" tone="muted">
                {t('habitsHub.archive.full', { max: choice.archiveMax })}
              </Text>
            ) : null}
          </>
        ) : step.kind === 'pick' ? (
          <>
            <Text variant="small" tone="muted">
              {t(step.action === 'archive' ? 'habitsHub.limit.pickArchive' : 'habitsHub.limit.pickDelete')}
            </Text>
            <View>
              {(choice?.candidates ?? []).map((p, i, all) => (
                <ListRow
                  key={p.id}
                  icon={step.action === 'archive' ? Archive : Trash2}
                  title={title(p)}
                  last={i === all.length - 1}
                  onPress={() => {
                    if (step.action === 'delete') {
                      setStep({ kind: 'confirmDelete', plan: p });
                      return;
                    }
                    setStore((s) => archivePlan(s, p.id, today));
                    toast(t('habitsHub.archive.doneToast', { habit: title(p) }));
                    freed();
                  }}
                />
              ))}
            </View>
            <ButtonPair primary={{ label: t('common.back'), onPress: () => setStep({ kind: 'choose' }), variant: 'outline' }} />
          </>
        ) : (
          <>
            <Text variant="body">{t(signedIn ? 'practice.plan.deleteConfirmSynced' : 'practice.plan.deleteConfirm')}</Text>
            <ButtonPair
              primary={{
                label: t('common.delete'),
                variant: 'destructive',
                onPress: () => {
                  setStore((s) => deletePlan(s, step.plan.id));
                  toast(t('practice.plan.deleted'));
                  freed();
                },
              }}
              secondary={{ label: t('common.cancel'), onPress: () => setStep({ kind: 'choose' }) }}
            />
          </>
        )}
      </View>
    </BottomSheet>
  );
}
