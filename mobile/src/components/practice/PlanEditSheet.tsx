/**
 * «عدّل» of a habit (owner round 5, F-31 a, A-13 a, F-13 a): every setting in ONE sheet: the reminder times, the days
 * (the user picks the days only; the count per week follows them and shows as «3 أيام في الأسبوع») and the two optional
 * answers («بعد ماذا ستفعلها؟», «إذا منعك شيء، فماذا تفعل؟»). «احفظ» confirms with a toast and closes. Pause and delete
 * live in the page's «⋯» (delete confirmed there).
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { nowIso, orderedSlots, slotChoices, validatePlan, type DeedWindow, type Plan } from '@thekra/practice-core';
import { weekdaysToRule } from '@/lib/practice/format';
import { activeDaysFrom, answersOf, loopFromAnswers, type LoopAnswers } from '@/lib/practice/habits-view';
import { newPracticeId } from '@/lib/practice/practice-store';
import { SlotsEditor, WeekdayPicker, type SlotChoice } from '@/components/practice/editors';
import { space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, ErrorText, Field, SectionDivider, Text } from '@/ui';

const makeStyles = (_t: Theme) => ({
  group: { gap: space.md },
});

export interface PlanEditSheetProps {
  visible: boolean;
  plan: Plan;
  title: string;
  window?: DeedWindow;
  /** The plan's days as weekdays, or null when its rule is not a weekday rule (then the days are not edited here). */
  ruleWeekdays: number[] | null;
  onClose: () => void;
  onSave: (next: Plan) => void;
}

export function PlanEditSheet({ visible, plan, title, window, ruleWeekdays, onClose, onSave }: PlanEditSheetProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [slots, setSlots] = useState<SlotChoice[]>(slotChoices(plan));
  const [weekdays, setWeekdays] = useState<number[] | null>(ruleWeekdays);
  const [answers, setAnswers] = useState<LoopAnswers>(answersOf(plan.loops));
  const [error, setError] = useState<string | null>(null);

  // Opening the sheet starts from the stored plan.
  useEffect(() => {
    if (!visible) return;
    setSlots(slotChoices(plan));
    setWeekdays(ruleWeekdays);
    setAnswers(answersOf(plan.loops));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function save() {
    setError(null);
    const rule = weekdays ? weekdaysToRule(weekdays) : null;
    if (weekdays && !rule) {
      setError(t('practice.add.noReminderDays'));
      return;
    }
    const ordered = orderedSlots(slots);
    const next: Plan = {
      ...plan,
      slots: ordered.slots,
      activeDaysPerWeek: activeDaysFrom(weekdays, plan.activeDaysPerWeek),
      ...(rule ? { rule } : {}),
    };
    if (ordered.slotAnchors) next.slotAnchors = ordered.slotAnchors;
    else delete next.slotAnchors;
    const loop = loopFromAnswers(answers, title, plan.loops?.[0]?.id ?? newPracticeId(), nowIso());
    const rest = (plan.loops ?? []).slice(1);
    if (loop) next.loops = [loop, ...rest];
    else if (rest.length > 0) next.loops = rest;
    else delete next.loops;
    if (validatePlan(next) !== null) {
      setError(t('practice.add.noSlots'));
      return;
    }
    onSave(next);
  }

  return (
    <BottomSheet
      visible={visible}
      title={t('habitsTab.plan.editTitle', { habit: title })}
      onClose={onClose}
      footer={<Button size="lg" label={t('practice.plan.save')} onPress={save} />}
    >
      <View style={styles.group}>
        <Text variant="heading" accessibilityRole="header">
          {t('practice.add.slots')}
        </Text>
        <SlotsEditor slots={slots} onChange={setSlots} window={window} />
      </View>
      {weekdays ? (
        <>
          <SectionDivider />
          <View style={styles.group}>
            <Text variant="heading" accessibilityRole="header">
              {t('habitsTab.plan.days')}
            </Text>
            <WeekdayPicker value={weekdays} onChange={setWeekdays} />
            <Text variant="small" tone={weekdays.length === 0 ? 'destructive' : 'muted'}>
              {weekdays.length === 0
                ? t('practice.add.noReminderDays')
                : t('habitsTab.plan.daysPerWeek', { days: t('practice.add.daysCount', { count: weekdays.length }) })}
            </Text>
          </View>
        </>
      ) : null}
      <SectionDivider />
      <LoopQuestions value={answers} onChange={setAnswers} />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </BottomSheet>
  );
}

/** «بعد ماذا ستفعلها؟» and «إذا منعك شيء، فماذا تفعل؟» (F-13 a), both optional. */
export function LoopQuestions({ value, onChange }: { value: LoopAnswers; onChange: (v: LoopAnswers) => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.group}>
      <Field
        label={t('habitsTab.loop.after')}
        placeholder={t('habitsTab.loop.afterPlaceholder')}
        value={value.after}
        maxLength={140}
        onChangeText={(after) => onChange({ ...value, after })}
      />
      <Field
        label={t('habitsTab.loop.ifBlocked')}
        placeholder={t('habitsTab.loop.ifBlockedPlaceholder')}
        value={value.ifBlocked}
        maxLength={140}
        onChangeText={(ifBlocked) => onChange({ ...value, ifBlocked })}
      />
    </View>
  );
}
