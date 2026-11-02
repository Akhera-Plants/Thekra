/**
 * «وردٌ أقصر» (owner round 3, item 15): today's open habits, each with a smaller amount and «سجّل القليل» (it logs that
 * amount for today, practice-core `logForDay`; it counts like any log), and the nafl prayer sitting: half the reward of
 * standing and better than leaving it (`mujahada.sittingPrayerHadith`, read by id behind «اقرأ الحديث»).
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { logForDay, updatePlan, type HabitItem } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { minimumRows } from '@/lib/practice/mujahada';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount, habitFor } from '@/lib/practice/reminders';
import { useDayAgenda } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, Icon, Text } from '@/ui';
import { ReadText } from './ReadText';
import { BottomSheet } from './Sheet';

const makeStyles = (t: Theme) => ({
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  texts: { flex: 1, gap: 2, minWidth: 0 },
  done: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
});

export function MinimumWirdSheet({ visible, onClose, sittingPrayerHadith }: { visible: boolean; onClose: () => void; sittingPrayerHadith: string | null | undefined }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const d = today();
  const items = useDayAgenda(d);
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const [logged, setLogged] = useState<ReadonlySet<string>>(() => new Set());
  const habitItems = useMemo(() => items.filter((i): i is HabitItem => i.kind === 'habit'), [items]);
  const rows = useMemo(() => minimumRows(habitItems, plans, habits, d), [habitItems, plans, habits, d]);
  const unitFallback = { minutes: t('practice.units.minutes'), count: t('practice.units.count'), times: t('practice.units.times') };

  function log(planId: string, amount: number) {
    setStore((s) => updatePlan(s, planId, (p) => logForDay(p, d, amount, d)));
    setLogged((prev) => new Set(prev).add(planId));
  }

  return (
    <BottomSheet visible={visible} title={t('mujahada.wird.title')} onClose={onClose}>
      <Text variant="small" tone="muted">
        {t('mujahada.wird.lead')}
      </Text>
      {rows.length === 0 && logged.size === 0 ? (
        <Text variant="body" tone="muted">
          {t('mujahada.wird.none')}
        </Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const title = row.habit ? pick(row.habit, 'title', locale) : row.plan.title;
            const amount = formatAmount(row.amount, row.plan.unit, row.habit, locale, unitFallback);
            return (
              <View key={row.planId} style={styles.row}>
                <View style={styles.texts}>
                  <Text variant="body">{title}</Text>
                  <Text variant="caption" tone="muted">
                    {t('mujahada.wird.amount', { amount })}
                  </Text>
                </View>
                <Button label={t('mujahada.wird.log')} onPress={() => log(row.planId, row.amount)} compact accessibilityLabel={`${t('mujahada.wird.log')}: ${title}`} />
              </View>
            );
          })}
          {[...logged].filter((id) => !rows.some((r) => r.planId === id)).map((id) => {
            const plan = plans.find((p) => p.id === id);
            if (!plan) return null;
            const habit = habitFor(plan, habits);
            return (
              <View key={id} style={styles.row}>
                <Text variant="body" tone="muted" style={styles.texts}>
                  {habit ? pick(habit, 'title', locale) : plan.title}
                </Text>
                <View style={styles.done}>
                  <Icon icon={Check} size={16} tone="link" />
                  <Text variant="small" tone="muted">
                    {t('mujahada.wird.logged')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
      {sittingPrayerHadith ? (
        <View style={styles.card}>
          <Text variant="heading">{t('mujahada.wird.sittingTitle')}</Text>
          <Text variant="small" tone="muted">
            {t('mujahada.wird.sittingBody')}
          </Text>
          <ReadText id={sittingPrayerHadith} />
        </View>
      ) : null}
    </BottomSheet>
  );
}
