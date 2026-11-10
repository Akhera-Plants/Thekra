/**
 * The plan screen's history and settings: «آخر 30 يومًا» (a kind band and one dot per day, no streaks and no failure
 * words, after the website's ProgressPanel) and the slots / active days / weekdays editor, with «احفظ» and, under a
 * the section's «احفظ» (pause lives in the page's «⋯» menu, A-15).
 */

import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { addDays, orderedSlots, reflectionOf, slotChoices, validatePlan, type DeedWindow, type Plan } from '@thekra/practice-core';
import { sortSlots, weekdaysToRule } from '@/lib/practice/format';
import { MONTH_DAYS, type PlanView } from '@/lib/practice/plan-view';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useShortDate } from '@/lib/practice/use-habits-hub';
import { DaySheet } from '@/components/practice/habits/DaySheet';
import { ActiveDaysPicker, SlotsEditor, WeekdayPicker, type SlotChoice } from '@/components/practice/editors';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, ErrorText, Section, Text } from '@/ui';

const SAVED_FLASH_MS = 1500;

const makeStyles = (t: Theme) => ({
  group: { gap: space.md },
  tight: { gap: space.xs },
  dots: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dotDone: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  dotToday: { borderWidth: 2, borderColor: t.colors.ring },
  dotBefore: { opacity: 0.3 },
  dotPressed: { opacity: 0.6 },
  written: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: t.colors.primary },
  writtenOnDone: { backgroundColor: t.colors.primaryForeground },
  legend: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs },
});

interface MonthPanelProps {
  plan: Plan;
  view: PlanView;
  today: string;
}

/**
 * «آخر 30 يومًا»: the band in kind words, the days logged, and one dot per day (oldest at the reading start). Round 7
 * (C4): a dot opens that day of this habit — what was logged and what was written (a small inner dot marks the days
 * with words).
 */
export function MonthPanel({ plan, view, today: d }: MonthPanelProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const shortDate = useShortDate();
  const store = usePracticeStore((s) => s.store);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const days = Array.from({ length: MONTH_DAYS }, (_, i) => addDays(d, -(MONTH_DAYS - 1 - i)));
  const daysText = t('practice.monthDays', { done: String(view.daysDone), count: view.targetDays });
  return (
    <Section title={t('practice.monthTitle')}>
      <View style={styles.tight}>
        <Text variant="body">
          <Text variant="body" weight="medium" tone="link">
            {t(`practice.band.${view.band}`)}
          </Text>
          {` · ${daysText}`}
        </Text>
        <Text variant="small" tone="muted">
          {t(`practice.band.${view.band}Hint`)}
        </Text>
      </View>
      <View style={styles.dots} accessibilityLabel={daysText}>
        {days.map((day) => {
          const done = (plan.log[day] ?? 0) > 0;
          const written = reflectionOf(store, plan.id, day) !== null;
          const before = day < plan.createdOn;
          return (
            <Pressable
              key={day}
              disabled={before}
              onPress={() => setOpenDay(day)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={[shortDate(day), done ? t('habitsHub.day.done') : null, written ? t('habitsHub.day.written') : null].filter(Boolean).join(' · ')}
              style={({ pressed }) => [styles.dot, done && styles.dotDone, day === d && styles.dotToday, before && styles.dotBefore, pressed && styles.dotPressed]}
            >
              {written ? <View style={[styles.written, done && styles.writtenOnDone]} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.written} />
        <Text variant="caption" tone="muted">
          {t('habitsHub.day.writtenLegend')}
        </Text>
      </View>
      <DaySheet date={openDay} planId={plan.id} onClose={() => setOpenDay(null)} />
    </Section>
  );
}

interface SettingsPanelProps {
  plan: Plan;
  /** The deed's time window (catalog): the slots editor offers only what suits it. */
  window?: DeedWindow;
  /** The plan's reminder rule as weekdays, or null when it is not a weekday rule. */
  ruleWeekdays: number[] | null;
  onSave: (next: Plan) => void;
}

export function SettingsPanel({ plan, window, ruleWeekdays, onSave }: SettingsPanelProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [slots, setSlots] = useState<SlotChoice[]>(slotChoices(plan));
  const [activeDays, setActiveDays] = useState(plan.activeDaysPerWeek);
  const [weekdays, setWeekdays] = useState<number[] | null>(ruleWeekdays);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ruleKey = JSON.stringify(ruleWeekdays);
  useEffect(() => {
    setSlots(slotChoices(plan));
    setActiveDays(plan.activeDaysPerWeek);
    setWeekdays(ruleWeekdays);
    // Reset the editors when the stored plan's settings change, not on every log.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, plan.slots.join(','), (plan.slotAnchors ?? []).join(','), plan.activeDaysPerWeek, ruleKey]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  function handleSave() {
    setError(null);
    const rule = weekdays ? weekdaysToRule(weekdays) : null;
    if (weekdays && !rule) {
      setError(t('practice.add.noReminderDays'));
      return;
    }
    const ordered = orderedSlots(slots);
    const next: Plan = { ...plan, slots: ordered.slots, activeDaysPerWeek: activeDays, ...(rule ? { rule } : {}) };
    if (ordered.slotAnchors) next.slotAnchors = ordered.slotAnchors;
    else delete next.slotAnchors;
    if (validatePlan(next) !== null) {
      setError(t('practice.add.noSlots'));
      return;
    }
    onSave(next);
    setSaved(true);
  }

  return (
    <Section title={t('practice.plan.settings')}>
      <View style={styles.group}>
        <Text variant="heading" accessibilityRole="header">
          {t('practice.add.slots')}
        </Text>
        <SlotsEditor slots={slots} onChange={setSlots} window={window} />
      </View>
      <View style={styles.group}>
        <Text variant="heading" accessibilityRole="header">
          {t('practice.add.activeDays')}
        </Text>
        <ActiveDaysPicker value={activeDays} onChange={setActiveDays} />
      </View>
      {weekdays ? (
        <View style={styles.group}>
          <Text variant="heading" accessibilityRole="header">
            {t('practice.add.reminderDays')}
          </Text>
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
        </View>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={saved ? t('practice.plan.saved') : t('practice.plan.save')} icon={saved ? Check : undefined} onPress={handleSave} />
    </Section>
  );
}
