/**
 * «طاعاتي»: the good-habits track of «عاداتي» («أعِنّي على طاعة», roadmap §3, lecture analysis §4 and §8), what the
 * «عاداتي» tab held before the hub. Where the data lives, «يومي ثقيل», today's habits (each a card with «أتممتها»
 * and a partial «+1»), «أضف عادة», the Ramadan season, habit reminders, and «فروضي وأدواري». All rules come from
 * @thekra/practice-core; data stays on the device (synced only when signed in).
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { HardDrive, Hourglass, Sprout } from 'lucide-react-native';
import { isDue, logDone, updatePlan, type Plan } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { ensurePermission } from '@/lib/practice/notifications';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount, habitFor, planRule } from '@/lib/practice/reminders';
import { useHeavyDay } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { HabitTodayCard } from '@/components/practice/HabitTodayCard';
import { RamadanBlock } from '@/components/practice/RamadanBlock';
import { radius, space, useStyles, type Theme } from '@/theme';
import {
  Button,
  EmptyState,
  ListRow,
  Notice,
  Ornament,
  PageHeader,
  Rule,
  Screen,
  Section,
  Skeleton,
  SwitchRow,
  Text,
} from '@/ui';

const SKELETON_CARDS = ['a', 'b'];

const makeStyles = (t: Theme) => ({
  group: { gap: space.md },
  tight: { gap: space.xs },
  skeletonCard: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
  },
});

const openAdd = () => router.push('/practice/add');
const openDuties = () => router.push('/practice/duties');

export default function HabitsTrackScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const store = usePracticeStore((s) => s.store);
  const prefs = usePracticeStore((s) => s.prefs);
  const setStore = usePracticeStore((s) => s.setStore);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const catalog = usePracticeCatalog(locale);
  const { hasPlans, heavy, setHeavy } = useHeavyDay();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const habits = catalog.data?.habits ?? [];
  const d = today();

  if (!hydrated) return <HabitsSkeleton />;

  const unitFallback = {
    minutes: t('practice.units.minutes'),
    count: t('practice.units.count'),
    times: t('practice.units.times'),
  };
  const amountLabel = (plan: Plan, amount: number) => formatAmount(amount, plan.unit, habitFor(plan, habits), locale, unitFallback);

  function handleLog(plan: Plan, amount: number, completes: boolean) {
    if (amount <= 0) return;
    setStore((s) => updatePlan(s, plan.id, (p) => logDone(p, d, amount)));
    if (completes) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleReminders(on: boolean) {
    setPermissionDenied(false);
    if (on && !(await ensurePermission(t('practice.notify.channelName')))) {
      setPermissionDenied(true);
      return;
    }
    setPrefs((p) => ({ ...p, habitReminders: on }));
  }

  return (
    <Screen edges={['bottom']}>
      <PageHeader eyebrow={t('practice.title')} title={t('practice.hub.habitsTrack')} lead={t('practice.lead')} />
      <Notice icon={HardDrive}>{t('practice.privateNote')}</Notice>

      {catalog.isError ? (
        <View style={styles.tight}>
          <Notice tone="destructive">{t('practice.catalogError')}</Notice>
          <Button label={t('common.retry')} onPress={() => void catalog.refetch()} variant="ghost" />
        </View>
      ) : null}

      {hasPlans ? (
        <>
          <SwitchRow label={t('practice.heavyDay')} hint={t('practice.heavyDayHint')} value={heavy} onValueChange={setHeavy} />
          <Section title={t('practice.today')}>
            {store.plans.map((plan) => (
              <HabitTodayCard
                key={plan.id}
                plan={plan}
                habit={habitFor(plan, habits)}
                reminderDay={safeIsDue(planRule(plan, habits), d, store.settings.hijriOffset)}
                amountLabel={(n) => amountLabel(plan, n)}
                onLog={(n, completes) => handleLog(plan, n, completes)}
              />
            ))}
            <Text variant="small" tone="muted">
              {t('practice.partialHint')}
            </Text>
          </Section>
          <Button label={t('practice.addHabit')} onPress={openAdd} arrow />
          <Rule />
          <RamadanBlock />
        </>
      ) : (
        <EmptyState
          icon={Sprout}
          message={t('practice.noPlans')}
          hint={t('practice.noPlansHint')}
          actionLabel={t('practice.addHabit')}
          onAction={openAdd}
        />
      )}

      <Rule />
      <Section title={t('practice.reminders')}>
        <SwitchRow
          label={t('practice.remindersSwitch')}
          hint={t('practice.remindersHint')}
          value={prefs.habitReminders}
          onValueChange={(v) => void handleReminders(v)}
        />
        {permissionDenied ? <Notice tone="destructive">{t('practice.permissionDenied')}</Notice> : null}
      </Section>

      <Ornament />
      <Section title={t('practice.tools')}>
        <View>
          <ListRow icon={Hourglass} title={t('practice.duties.title')} onPress={openDuties} />
        </View>
      </Section>
    </Screen>
  );
}

function safeIsDue(rule: Parameters<typeof isDue>[0], date: string, hijriOffset: number): boolean {
  try {
    return isDue(rule, date, { hijriOffset });
  } catch {
    return false;
  }
}

/** The shape of the page while the device store loads. */
function HabitsSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Screen edges={['bottom']}>
      <View style={styles.group} accessibilityLabel={t('common.loading')}>
        <Skeleton width="40%" height={30} />
        <Skeleton width="85%" height={14} />
      </View>
      {SKELETON_CARDS.map((key) => (
        <View key={key} style={styles.skeletonCard}>
          <Skeleton width="55%" height={20} />
          <Skeleton width="70%" height={14} />
          <Skeleton width={120} height={43} />
        </View>
      ))}
    </Screen>
  );
}
