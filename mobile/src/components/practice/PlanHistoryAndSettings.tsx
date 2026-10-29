/**
 * The plan screen's history and settings: «آخر 30 يومًا» (a kind band and one dot per day, no streaks and no failure
 * words, after the website's ProgressPanel) and the slots / active days / weekdays editor.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { addDays, planAnchors, validatePlan, type LocalTime, type Plan, type PlanAnchor } from '@thekra/practice-core';
import { sortSlots, weekdaysToRule } from '@/lib/practice/format';
import { MONTH_DAYS, type PlanView } from '@/lib/practice/plan-view';
import { ActiveDaysPicker, SlotsEditor, WeekdayPicker } from '@/components/practice/editors';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, ErrorText, Section, Text } from '@/ui';

const SAVED_FLASH_MS = 1500;

const makeStyles = (t: Theme) => ({
  group: { gap: space.md },
  tight: { gap: space.xs },
  dots: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  dot: { width: 12, height: 12, borderRadius: radius.full, borderWidth: 1, borderColor: t.colors.border },
  dotDone: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  dotBefore: { opacity: 0.3 },
});

interface MonthPanelProps {
  plan: Plan;
  view: PlanView;
  today: string;
}

/** «آخر 30 يومًا»: the band in kind words, the days logged, and one dot per day (oldest at the reading start). */
export function MonthPanel({ plan, view, today: d }: MonthPanelProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
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
      <View style={styles.dots} accessibilityRole="image" accessibilityLabel={daysText}>
        {days.map((day) => (
          <View
            key={day}
            style={[styles.dot, (plan.log[day] ?? 0) > 0 && styles.dotDone, day < plan.createdOn && styles.dotBefore]}
          />
        ))}
      </View>
    </Section>
  );
}

interface SettingsPanelProps {
  plan: Plan;
  /** The plan's reminder rule as weekdays, or null when it is not a weekday rule. */
  ruleWeekdays: number[] | null;
  onSave: (next: Plan) => void;
}

export function SettingsPanel({ plan, ruleWeekdays, onSave }: SettingsPanelProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [slots, setSlots] = useState<LocalTime[]>(plan.slots);
  const [anchors, setAnchors] = useState<PlanAnchor[]>(() => planAnchors(plan));
  const [activeDays, setActiveDays] = useState(plan.activeDaysPerWeek);
  const [weekdays, setWeekdays] = useState<number[] | null>(ruleWeekdays);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ruleKey = JSON.stringify(ruleWeekdays);
  const anchorsKey = JSON.stringify(planAnchors(plan));
  useEffect(() => {
    setSlots(plan.slots);
    setAnchors(planAnchors(plan));
    setActiveDays(plan.activeDaysPerWeek);
    setWeekdays(ruleWeekdays);
    // Reset the editors when the stored plan's settings change, not on every log.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, plan.slots.join(','), anchorsKey, plan.activeDaysPerWeek, ruleKey]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  function handleSlots(nextSlots: LocalTime[], nextAnchors: PlanAnchor[]) {
    setSlots(nextSlots);
    setAnchors(nextAnchors);
  }

  function handleSave() {
    setError(null);
    const rule = weekdays ? weekdaysToRule(weekdays) : null;
    if (weekdays && !rule) {
      setError(t('practice.add.noReminderDays'));
      return;
    }
    const next: Plan = { ...plan, slots: sortSlots(slots), anchors, activeDaysPerWeek: activeDays, ...(rule ? { rule } : {}) };
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
        <SlotsEditor slots={slots} anchors={anchors} onChange={handleSlots} />
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
