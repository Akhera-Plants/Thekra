/**
 * The limit sheet (redesign §3; owner round 3, item 16; round 5, F-30 a), shown instead of adding past a limit: why
 * (practice-core `limitBlock`: 3 habits younger than three months; 7 periodic acts; 3 «تخفَّف» programs, or one not yet
 * two months old) and the day it unlocks by itself in words («من 3 ديسمبر»), then two actions only, side by side at one
 * size: «أكمل ما عندي» (solid, closes) and «أوقِف … مؤقتًا» (pick one; its history stays). No delete here: deleting a
 * habit lives behind its page's «⋯» with a confirmation. The program limit has only the first action. Every change goes
 * through practice-core store helpers.
 */

import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { limitBlock, pausePlan, updatePlan, type LimitKind, type Limits, type Plan } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { dayMonth } from '@/lib/practice/calendar-grid';
import { useDateNames } from '@/lib/practice/use-habits-hub';
import { limitMessage } from '@/lib/practice/limit-message';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
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

type Step = 'menu' | 'pause';

export interface LimitSheetProps {
  kind: LimitKind;
  visible: boolean;
  limits: Limits;
  /** «أكمل ما عندي», the backdrop or Android back. */
  onClose: () => void;
  /** A place was freed (paused): the caller goes on with the addition. */
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
  function pause(id: string) {
    setStore((s) => updatePlan(s, id, (p) => pausePlan(p, today())));
    reset();
    toast(t('practice.paused.done'));
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
                secondary={candidates.length > 0 ? { label: t(`practice.limits.${kind}.pause`), onPress: () => setStep('pause') } : null}
              />
            </>
          ) : (
            <>
              <Text variant="small" tone="muted">
                {t('practice.limits.pickPause')}
              </Text>
              <View style={styles.picks}>
                {candidates.map((plan) => (
                  <Chip key={plan.id} label={titleOf(plan)} selected={picked === plan.id} onPress={() => setPicked(plan.id)} />
                ))}
              </View>
              <ButtonPair
                primary={{ label: t('practice.limits.pauseAction'), disabled: picked === null, onPress: () => picked && pause(picked) }}
                secondary={{ label: t('practice.limits.back'), onPress: reset }}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
