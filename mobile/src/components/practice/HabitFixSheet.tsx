/**
 * «خربانة؟ صلّحها» for a good-deed habit (owner round 3, decision 1: it moved inside each habit of «عاداتي»). After a
 * missed day, three short steps, each with its own action: (1) «لا تفوّتها مرتين»: log the least of it today (the
 * minimum, else what is asked); (2) «اقضِ ما فاتك»: log yesterday while it can still be made up (practice-core
 * `canMakeUp`, until noon today); (3) «خفّف المقدار»: open the habit to lower its amount. Every change goes through
 * practice-core; nothing is said about failing.
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { addDays, baseAmount, canMakeUp, logForDay, minimumToLog, requiredOn, updatePlan, type LocalDate, type Plan } from '@thekra/practice-core';
import type { CatalogHabit } from '@/lib/practice/catalog-types';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, Text } from '@/ui';
import { BottomSheet } from './mujahada/Sheet';

const makeStyles = (t: Theme) => ({
  step: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  num: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.ring,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

export interface HabitFixSheetProps {
  visible: boolean;
  onClose: () => void;
  plan: Plan | undefined;
  habit: CatalogHabit | undefined;
  title: string;
  today: LocalDate;
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children?: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.step}>
      <View style={styles.head}>
        <View style={styles.num}>
          <Text variant="small" tone="link">
            {String(n)}
          </Text>
        </View>
        <Text variant="heading" style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      <Text variant="small" tone="muted">
        {body}
      </Text>
      {children}
    </View>
  );
}

export function HabitFixSheet({ visible, onClose, plan, habit, title, today }: HabitFixSheetProps) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const setStore = usePracticeStore((s) => s.setStore);
  if (!plan) return null;
  const yesterday = addDays(today, -1);
  const unitFallback = { minutes: t('practice.units.minutes'), count: t('practice.units.count'), times: t('practice.units.times') };
  const amount = (n: number) => formatAmount(n, plan.unit, habit, locale, unitFallback);
  const doneToday = plan.log[today] ?? 0;
  const least = minimumToLog(plan, today) ?? Math.max(0, requiredOn(plan, today) - doneToday);
  const makeUp = canMakeUp(yesterday, today) && (plan.log[yesterday] ?? 0) <= 0;
  const yesterdayAmount = baseAmount(plan);

  function log(date: LocalDate, n: number) {
    if (!plan || n <= 0) return;
    setStore((s) => updatePlan(s, plan.id, (p) => logForDay(p, date, n, today)));
    onClose();
  }

  return (
    <BottomSheet visible={visible} title={`${t('myHabits.fixTitle')}: ${title}`} onClose={onClose}>
      <Text variant="small" tone="muted">
        {t('myHabits.fixLead')}
      </Text>
      <Step n={1} title={t('myHabits.fixSteps.least.title')} body={t('myHabits.fixSteps.least.body')}>
        {least > 0 ? <Button label={t('myHabits.fixSteps.least.action', { amount: amount(least) })} onPress={() => log(today, least)} block /> : null}
      </Step>
      {makeUp ? (
        <Step n={2} title={t('myHabits.fixSteps.makeUp.title')} body={t('myHabits.fixSteps.makeUp.body')}>
          <Button
            label={t('myHabits.fixSteps.makeUp.action', { amount: amount(yesterdayAmount) })}
            onPress={() => log(yesterday, yesterdayAmount)}
            variant="outline"
            block
          />
        </Step>
      ) : null}
      <Step n={makeUp ? 3 : 2} title={t('myHabits.fixSteps.lighter.title')} body={t('myHabits.fixSteps.lighter.body')}>
        <Button
          label={t('myHabits.fixSteps.lighter.action')}
          onPress={() => {
            onClose();
            router.push(`/practice/plan/${plan.id}`);
          }}
          variant="outline"
          arrow
          block
        />
      </Step>
    </BottomSheet>
  );
}
