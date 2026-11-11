/**
 * Archive and the limit of 3 (owner round 6, owner chat + C-01d; practice-core archive.ts):
 * - {@link ArchiveSheet}: «أرشِف» says plainly what happens — the habit leaves «اليوم» and the count of 3, its history
 *   stays in «سجلّي», and after more than 3 days in the archive its progress starts again. At most 10 in the archive:
 *   beyond that the member deletes one first. There is no second «pause» anywhere: the archive IS the pause.
 * - {@link HabitAddChoiceSheet}: «أضف» with 3 habits: «لديك 3 عادات — أرشِف واحدة أو احذفها» (two buttons) with the
 *   3-day note, then the habit to free; deleting is confirmed in the same sheet.
 * - {@link ArchiveFullDelete}: the archive is full (10): «احذف واحدة من الأرشيف» — the archived habits, each deleted after
 *   a confirmation in the same sheet; then archiving goes on. Used by {@link ArchiveSheet} and the limit sheets.
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
  archivedPlans,
  canArchive,
  deletePlan,
  habitAddChoice,
  LIMITS,
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
import { BottomSheet, ButtonPair, ListRow, Notice, Text, confirm, toast } from '@/ui';

const makeStyles = () => ({
  stack: { gap: space.md },
});

export function ArchiveSheet({ plan, title, today, visible, onClose, onDone }: { plan: Plan | undefined; title: string; today: LocalDate; visible: boolean; onClose: () => void; onDone?: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const full = !canArchive(store);
  // Archive full (C-01d / owner chat: at most 10, beyond that delete): the sheet offers deleting one from the archive.
  const [freeing, setFreeing] = useState(false);
  const close = () => {
    setFreeing(false);
    onClose();
  };
  return (
    <BottomSheet visible={visible && plan !== undefined} title={freeing ? t('habitsHub.archive.deleteForever') : t('habitsHub.archive.confirmTitle', { habit: title })} onClose={close}>
      <View style={styles.stack}>
        {freeing ? (
          <ArchiveFullDelete onDeleted={() => setFreeing(false)} onBack={() => setFreeing(false)} />
        ) : (
          <>
            <Text variant="body">{t('habitsHub.archive.confirmBody', { days: ARCHIVE_RESET_DAYS })}</Text>
            {full ? <Notice tone="destructive">{t('habitsHub.archive.full', { max: ARCHIVE_MAX })}</Notice> : null}
            <ButtonPair
              primary={
                full
                  ? { label: t('habitsHub.archive.deleteForever'), icon: Trash2, variant: 'outline', onPress: () => setFreeing(true) }
                  : {
                      label: t('habitsHub.archive.action'),
                      icon: Archive,
                      onPress: () => {
                        if (!plan) return;
                        setStore((s) => archivePlan(s, plan.id, today));
                        toast(t('habitsHub.archive.doneToast', { habit: title }));
                        close();
                        onDone?.();
                      },
                    }
              }
              secondary={{ label: t('common.cancel'), onPress: close }}
            />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

/**
 * The archive is full: pick one archived habit to delete (its history goes with it), confirm, delete, toast. Rendered
 * inside a sheet; `onDeleted` runs once a place in the archive is free.
 */
export function ArchiveFullDelete({ onDeleted, onBack }: { onDeleted: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const archived = archivedPlans(store);
  const title = (p: Plan) => planTitleOf(p, habits, locale);
  // Deleting is permanent, so it is confirmed in our ConfirmDialog (never in the sheet itself).
  async function askDelete(p: Plan) {
    const ok = await confirm({
      title: t('habitsHub.habits.deleteTitle', { habit: title(p) }),
      message: t(signedIn ? 'practice.plan.deleteConfirmSynced' : 'practice.plan.deleteConfirm'),
      confirmLabel: t('habitsHub.archive.deleteForeverConfirm'),
      tone: 'destructive',
    });
    if (!ok) return;
    setStore((s) => deletePlan(s, p.id));
    toast(t('habitsHub.archive.deletedToast', { habit: title(p) }));
    onDeleted();
  }
  return (
    <View style={styles.stack}>
      <Text variant="small" tone="muted">
        {t('habitsHub.archive.pickDelete', { max: ARCHIVE_MAX })}
      </Text>
      <View>
        {archived.map((p, i) => (
          <ListRow key={p.id} icon={Trash2} title={title(p)} last={i === archived.length - 1} onPress={() => void askDelete(p)} />
        ))}
      </View>
      <ButtonPair primary={{ label: t('common.back'), onPress: onBack, variant: 'outline' }} />
    </View>
  );
}

type Step = { kind: 'choose' } | { kind: 'freeArchive' } | { kind: 'pick'; action: 'archive' | 'delete' } | { kind: 'confirmDelete'; plan: Plan };

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
    <BottomSheet visible={visible} title={step.kind === 'freeArchive' ? t('habitsHub.archive.deleteForever') : t('habitsHub.limit.title', { count: choice?.count ?? LIMITS.sapling })} onClose={close}>
      <View style={styles.stack}>
        {step.kind === 'choose' ? (
          <>
            <Text variant="body">{t('habitsHub.limit.body')}</Text>
            <Text variant="small" tone="muted">
              {t('habitsHub.limit.note', { days: choice?.resetDays ?? ARCHIVE_RESET_DAYS })}
            </Text>
            <ButtonPair
              primary={{
                // A full archive: the first button says what it leads to (deleting from the archive for good).
                label: choice && !choice.options.includes('archive') ? t('habitsHub.archive.deleteForever') : t('habitsHub.limit.archive'),
                icon: choice && !choice.options.includes('archive') ? Trash2 : Archive,
                // A full archive (10) first asks to delete one from it (owner chat: beyond 10, delete).
                onPress: () => setStep(choice && !choice.options.includes('archive') ? { kind: 'freeArchive' } : { kind: 'pick', action: 'archive' }),
              }}
              secondary={{ label: t('habitsHub.limit.delete'), icon: Trash2, onPress: () => setStep({ kind: 'pick', action: 'delete' }) }}
            />
            {choice && !choice.options.includes('archive') ? (
              <Text variant="small" tone="muted">
                {t('habitsHub.archive.full', { max: choice.archiveMax })}
              </Text>
            ) : null}
          </>
        ) : step.kind === 'freeArchive' ? (
          <ArchiveFullDelete onDeleted={() => setStep({ kind: 'pick', action: 'archive' })} onBack={() => setStep({ kind: 'choose' })} />
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
