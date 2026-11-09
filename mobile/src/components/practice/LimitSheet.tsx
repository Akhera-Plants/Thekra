/**
 * The limit sheet (redesign §3; owner round 3, item 16; round 5, F-30 a), shown instead of adding past a limit: why
 * (practice-core `limitBlock`: 3 habits younger than three months; 7 periodic acts; 3 «تخفَّف» programs, or one not yet
 * two months old) and the day it unlocks by itself in words («من 3 ديسمبر»), then two actions only, side by side at one
 * size: «أكمل ما عندي» (solid, closes) and «أرشِف …» (pick one; its history stays). The archive IS the old pause (owner
 * round 6): it goes through practice-core `archivePlan`, so its cap of 10 holds here too; with a full archive the second
 * action is «احذف …» instead (pick one, confirm in the same sheet; its history goes with it). The program limit has
 * only the first action. Every change goes through practice-core store helpers and toasts.
 */

import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ARCHIVE_MAX, archivePlan, canArchive, deletePlan, limitBlock, type LimitKind, type Limits, type Plan } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { dayMonth } from '@/lib/practice/calendar-grid';
import { useDateNames } from '@/lib/practice/use-habits-hub';
import { limitMessage } from '@/lib/practice/limit-message';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useAuthStore } from '@/lib/stores/auth-store';
import { GUTTER, radius, space, useStyles, type Theme } from '@/theme';
import { ButtonPair, Chip, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  root: { flex: 1, justifyContent: 'flex-end' as const },
  backdrop: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.colors.overlay },
  sheet: {
    backgroundColor: t.colors.card,
    borderTopStartRadius: radius.panel,
    borderTopEndRadius: radius.panel,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: t.colors.border,
    paddingHorizontal: GUTTER,
    paddingTop: space.lg,
    gap: space.md,
  },
  picks: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  pair: { flexDirection: 'row' as const, gap: space.sm },
  half: { flex: 1 },
});

type Step = 'menu' | 'pause' | 'confirmDelete';

export interface LimitSheetProps {
  kind: LimitKind;
  visible: boolean;
  limits: Limits;
  /** «أكمل ما عندي», the backdrop or Android back. */
  onClose: () => void;
  /** A place was freed (archived or deleted): the caller goes on with the addition. */
  onFreed: () => void;
}

export function LimitSheet({ kind, visible, limits, onClose, onFreed }: LimitSheetProps) {
  const { t } = useTranslation();
  const names = useDateNames();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const locale = useUiLocale();
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const setStore = usePracticeStore((s) => s.setStore);
  const [step, setStep] = useState<Step>('menu');
  const [picked, setPicked] = useState<string | null>(null);
  const store = usePracticeStore((s) => s.store);
  const candidates = kind === 'sapling' ? limits.saplings : kind === 'periodic' ? limits.periodicPlans : [];
  const block = limitBlock(store, today(), kind, { isPeriodicAct: (plan) => habitFor(plan, habits)?.kind === 'periodic' });
  // The unlock date in words, «من 24 ديسمبر» (F-30), not «24/12».
  const why = block ? limitMessage(block, (date) => dayMonth(date, names)) : null;
  const titleOf = (plan: Plan) => {
    const habit = habitFor(plan, habits);
    return habit ? pick(habit, 'title', locale) : plan.title;
  };

  function reset() {
    setStep('menu');
    setPicked(null);
  }
  function close() {
    reset();
    onClose();
  }
  // Archive full (10): the second action deletes instead of archiving (owner chat: beyond 10, delete).
  const archiveFull = !canArchive(store);
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const pickedPlan = candidates.find((p) => p.id === picked);
  function archive(id: string) {
    const plan = candidates.find((p) => p.id === id);
    setStore((s) => archivePlan(s, id, today()));
    reset();
    toast(t('habitsHub.archive.doneToast', { habit: plan ? titleOf(plan) : '' }));
    onFreed();
  }
  function remove(id: string) {
    setStore((s) => deletePlan(s, id));
    reset();
    toast(t('practice.plan.deleted'));
    onFreed();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <Text variant="heading" accessibilityRole="header">
            {t(`practice.limits.${kind}.title`)}
          </Text>
          {step === 'menu' ? (
            <>
              {why ? (
                <Text variant="small" tone="muted">
                  {t(why.key, why.params)}
                </Text>
              ) : null}
              <ButtonPair
                size="lg"
                primary={{ label: t('practice.limits.keepGoing'), onPress: close }}
                secondary={candidates.length > 0 ? { label: t(`practice.limits.${kind}.${archiveFull ? 'delete' : 'pause'}`), onPress: () => setStep('pause') } : null}
              />
              {candidates.length > 0 && archiveFull ? (
                <Text variant="small" tone="muted">
                  {t('habitsHub.archive.fullShort', { max: ARCHIVE_MAX })}
                </Text>
              ) : null}
            </>
          ) : step === 'confirmDelete' && pickedPlan ? (
            <>
              <Text variant="body">{t('habitsHub.habits.deleteTitle', { habit: titleOf(pickedPlan) })}</Text>
              <Text variant="small" tone="muted">
                {t(signedIn ? 'practice.plan.deleteConfirmSynced' : 'practice.plan.deleteConfirm')}
              </Text>
              <ButtonPair
                primary={{ label: t('common.delete'), variant: 'destructive', onPress: () => remove(pickedPlan.id) }}
                secondary={{ label: t('common.cancel'), onPress: () => setStep('pause') }}
              />
            </>
          ) : (
            <>
              <Text variant="small" tone="muted">
                {t(archiveFull ? 'practice.limits.pickDelete' : 'practice.limits.pickPause')}
              </Text>
              <View style={styles.picks}>
                {candidates.map((plan) => (
                  <Chip key={plan.id} label={titleOf(plan)} selected={picked === plan.id} onPress={() => setPicked(plan.id)} />
                ))}
              </View>
              <ButtonPair
                primary={
                  archiveFull
                    ? { label: t('practice.limits.deleteAction'), variant: 'destructive', disabled: picked === null, onPress: () => picked && setStep('confirmDelete') }
                    : { label: t('practice.limits.pauseAction'), disabled: picked === null, onPress: () => picked && archive(picked) }
                }
                secondary={{ label: t('practice.limits.back'), onPress: reset }}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
