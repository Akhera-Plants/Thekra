/**
 * One habit today on «طاعاتي» (moved from the old «عاداتي» tab): its title opens the plan; «أتممتها» and a partial «+1»
 * log without leaving the list (partial amounts add up, same-day make-up, never doubled); quiet status lines under
 * the amount (done, reminder day, heavy day, season).
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BellRing, Check, Feather, Moon, type LucideIcon } from 'lucide-react-native';
import type { Plan } from '@thekra/practice-core';
import { pick, type CatalogHabit } from '@/lib/practice/catalog-types';
import { shortDate } from '@/lib/practice/format';
import { planView } from '@/lib/practice/plan-view';
import { today } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { space, useStyles } from '@/theme';
import { Button, Card, ForwardChevron, Icon, Text, Wrap } from '@/ui';

const makeStyles = () => ({
  tight: { gap: space.xs },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 44,
  },
  cardHeaderPressed: { opacity: 0.7 },
  cardTitle: { flex: 1 },
  meta: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, columnGap: space.lg, rowGap: space.xs },
  metaItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
});

export interface HabitTodayCardProps {
  plan: Plan;
  habit: CatalogHabit | undefined;
  reminderDay: boolean;
  amountLabel: (n: number) => string;
  onLog: (amount: number, completes: boolean) => void;
}

export function HabitTodayCard({ plan, habit, reminderDay, amountLabel, onLog }: HabitTodayCardProps) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const view = planView(plan, today());
  const title = habit ? pick(habit, 'title', locale) : plan.title;

  return (
    <Card>
      <Pressable
        onPress={() => router.push(`/practice/plan/${plan.id}`)}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => [styles.cardHeader, pressed && styles.cardHeaderPressed]}
      >
        <Text variant="heading" style={styles.cardTitle}>
          {title}
        </Text>
        <ForwardChevron size={18} tone="muted" />
      </Pressable>

      <View style={styles.tight}>
        <Text variant="body">{t('practice.plan.required', { amount: amountLabel(view.required) })}</Text>
        {view.done > 0 && !view.doneToday ? (
          <Text variant="small" tone="muted">
            {t('practice.plan.done', { amount: amountLabel(view.done) })}
          </Text>
        ) : null}
      </View>

      <PlanMeta
        doneToday={view.doneToday}
        reminderDay={reminderDay}
        inEbb={view.inEbb}
        seasonUntil={view.inSeason && plan.season ? plan.season.until : null}
      />

      <Wrap>
        {!view.doneToday ? <Button label={t('practice.logRest')} icon={Check} onPress={() => onLog(view.remaining, true)} /> : null}
        <Button label={t('practice.logPlusOne')} onPress={() => onLog(1, !view.doneToday && view.remaining <= 1)} variant="outline" />
      </Wrap>
    </Card>
  );
}

interface PlanMetaProps {
  doneToday: boolean;
  reminderDay: boolean;
  inEbb: boolean;
  seasonUntil: string | null;
}

/** Quiet status lines under the amount: done, reminder day, heavy day, season. */
function PlanMeta({ doneToday, reminderDay, inEbb, seasonUntil }: PlanMetaProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const items: { key: string; icon: LucideIcon; label: string; strong?: boolean }[] = [];
  if (doneToday) items.push({ key: 'done', icon: Check, label: t('practice.doneToday'), strong: true });
  if (reminderDay) items.push({ key: 'reminder', icon: BellRing, label: t('practice.reminderDay') });
  if (inEbb) items.push({ key: 'ebb', icon: Feather, label: t('practice.ebbActive') });
  if (seasonUntil) items.push({ key: 'season', icon: Moon, label: t('practice.seasonActive', { date: shortDate(seasonUntil) }) });
  if (items.length === 0) return null;
  return (
    <View style={styles.meta}>
      {items.map((item) => (
        <View key={item.key} style={styles.metaItem}>
          <Icon icon={item.icon} size={15} tone={item.strong ? 'link' : 'muted'} />
          <Text variant="caption" weight={item.strong ? 'medium' : 'regular'} tone={item.strong ? 'link' : 'muted'}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
