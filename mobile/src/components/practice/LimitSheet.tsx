/**
 * The limit sheet (redesign §3), shown instead of adding past a limit (3 saplings, 7 periodic acts, 1 «تخفَّف»
 * program): «أكمل ما عندي» (primary, closes), «أوقِف … مؤقتًا» (pick one; its history stays), «احذف …» (pick one, then
 * confirm), and «ثبّت … وابدأ الجديدة» for a graduation-ready sapling. The program limit has only the first action.
 * Every change goes through practice-core store helpers.
 */

import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { deletePlan, establishPlan, pausePlan, updatePlan, type LimitKind, type Limits, type Plan } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { GUTTER, radius, space, useStyles, type Theme } from '@/theme';
import { Button, Chip, Text } from '@/ui';

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
});

type Step = 'menu' | 'pause' | 'delete' | 'confirm';

export interface LimitSheetProps {
  kind: LimitKind;
  visible: boolean;
  limits: Limits;
  /** «أكمل ما عندي», the backdrop or Android back. */
  onClose: () => void;
  /** A place was freed (paused, deleted, moved to «راسخة»): the caller goes on with the addition. */
  onFreed: () => void;
}

export function LimitSheet({ kind, visible, limits, onClose, onFreed }: LimitSheetProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const locale = useUiLocale();
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const setStore = usePracticeStore((s) => s.setStore);
  const [step, setStep] = useState<Step>('menu');
  const [picked, setPicked] = useState<string | null>(null);
  const candidates = kind === 'sapling' ? limits.saplings : kind === 'periodic' ? limits.periodicPlans : [];
  const ready = kind === 'sapling' ? limits.graduationReady : [];
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
  function freed(id: string, change: (plan: Plan) => Plan | null) {
    setStore((s) => {
      const next = s.plans.find((p) => p.id === id);
      if (!next) return s;
      const changed = change(next);
      return changed === null ? deletePlan(s, id) : updatePlan(s, id, () => changed);
    });
    reset();
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
              <Button label={t('practice.limits.keepGoing')} onPress={close} block />
              {ready.map((plan) => (
                <Button
                  key={plan.id}
                  label={t('practice.limits.establishAndStart', { title: titleOf(plan) })}
                  variant="outline"
                  block
                  onPress={() => freed(plan.id, (p) => establishPlan(p, today()))}
                />
              ))}
              {candidates.length > 0 ? (
                <>
                  <Button label={t(`practice.limits.${kind}.pause`)} variant="outline" block onPress={() => setStep('pause')} />
                  <Button label={t(`practice.limits.${kind}.delete`)} variant="ghost" block onPress={() => setStep('delete')} />
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text variant="small" tone="muted">
                {step === 'pause' ? t('practice.limits.pickPause') : step === 'confirm' ? t('practice.limits.deleteNote') : t('practice.limits.pickDelete')}
              </Text>
              <View style={styles.picks}>
                {candidates.map((plan) => (
                  <Chip key={plan.id} label={titleOf(plan)} selected={picked === plan.id} onPress={() => setPicked(plan.id)} />
                ))}
              </View>
              {step === 'pause' ? (
                <Button
                  label={t('practice.limits.pauseAction')}
                  block
                  onPress={() => picked && freed(picked, (p) => pausePlan(p, today()))}
                />
              ) : step === 'delete' ? (
                <Button label={t('practice.limits.deleteAction')} variant="outline" block onPress={() => picked && setStep('confirm')} />
              ) : (
                <Button label={t('practice.limits.deleteConfirm')} variant="destructive" block onPress={() => picked && freed(picked, () => null)} />
              )}
              <Button label={t('practice.limits.back')} variant="ghost" block onPress={reset} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
