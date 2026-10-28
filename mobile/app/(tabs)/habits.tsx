/**
 * «عاداتي» — «أعِنّي على طاعة» (roadmap §3, lecture analysis §4 and §8).
 * Today's list with a log button (partial amounts add up, same-day make-up, never doubled), the «يومي ثقيل»
 * ebb switch, the Ramadan season, habit reminders, and the entry points to the other practice tools.
 * All rules come from @thekra/practice-core; data stays on the device (synced only when signed in).
 */

import React from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { addDays, endEbb, isDue, logDone, normalize, startEbb, startSeason, updatePlan, type Plan, type Store } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick, type CatalogHabit } from '@/lib/practice/catalog-types';
import { shortDate } from '@/lib/practice/format';
import { ensurePermission } from '@/lib/practice/notifications';
import { planView, ramadanSeasonUntil, seasonAmount } from '@/lib/practice/plan-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount, habitFor, planRule } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';
import {
  Body,
  Button,
  Card,
  LinkRow,
  Loading,
  Row,
  Screen,
  SectionTitle,
  Subtitle,
  SwitchRow,
  Title,
} from '@/components/practice/ui';

export default function HabitsScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const store = usePracticeStore((s) => s.store);
  const prefs = usePracticeStore((s) => s.prefs);
  const setStore = usePracticeStore((s) => s.setStore);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const catalog = usePracticeCatalog(locale);
  const habits = catalog.data?.habits ?? [];
  const d = today();

  if (!hydrated) return <Loading />;

  const unitFallback = {
    minutes: t('practice.units.minutes'),
    count: t('practice.units.count'),
    times: t('practice.units.times'),
  };
  const amountLabel = (plan: Plan, amount: number) =>
    formatAmount(amount, plan.unit, habitFor(plan, habits), locale, unitFallback);

  const heavy = store.plans.length > 0 && store.plans.every((p) => p.ebb);
  const seasonPlans = store.plans.filter((p) => p.season && d <= p.season.until);
  const season = ramadanSeasonUntil(d, store.settings.hijriOffset);

  // Every edit goes through practice-core's store helpers (updatePlan stamps versions for sync).
  const eachPlan = (s: Store, change: (p: Plan) => Plan | null): Store =>
    s.plans.reduce((acc, p) => {
      const next = change(p);
      return next ? updatePlan(acc, p.id, () => next) : acc;
    }, s);

  function log(plan: Plan, amount: number) {
    if (amount <= 0) return;
    setStore((s) => updatePlan(s, plan.id, (p) => logDone(p, d, amount)));
  }

  function toggleHeavy(on: boolean) {
    setStore((s) => eachPlan(s, (p) => (on ? (p.ebb ? null : startEbb(p, d)) : p.ebb ? endEbb(p) : null)));
  }

  function startRamadan() {
    setStore((s) =>
      eachPlan(s, (p) => {
        const amount = seasonAmount(p);
        return amount > p.amount ? startSeason(p, amount, season.until) : null;
      }),
    );
  }

  function endRamadan() {
    // practice-core `normalize` restores the everyday amount once `until` has passed; ending early = the day after.
    setStore((s) => eachPlan(s, (p) => (p.season ? normalize(p, addDays(p.season.until, 1)) : null)));
  }

  async function toggleReminders(on: boolean) {
    if (on && !(await ensurePermission(t('practice.notify.channelName')))) {
      Alert.alert(t('practice.permissionDenied'));
      return;
    }
    setPrefs((p) => ({ ...p, habitReminders: on }));
  }

  return (
    <Screen edges={['top']}>
      <Title>{t('practice.title')}</Title>
      <Subtitle>{t('practice.subtitle')}</Subtitle>

      <SectionTitle>{t('practice.today')}</SectionTitle>
      {store.plans.length === 0 ? (
        <Card>
          <Body>{t('practice.noPlans')}</Body>
          <Body muted small>
            {t('practice.noPlansHint')}
          </Body>
        </Card>
      ) : (
        <>
          {store.plans.map((plan) => (
            <TodayCard
              key={plan.id}
              plan={plan}
              habit={habitFor(plan, habits)}
              reminderDay={safeIsDue(planRule(plan, habits), d, store.settings.hijriOffset)}
              amountLabel={(n) => amountLabel(plan, n)}
              onLog={(n) => log(plan, n)}
            />
          ))}
          <Body small muted>
            {t('practice.partialHint')}
          </Body>
        </>
      )}

      <Button label={t('practice.addHabit')} onPress={() => router.push('/practice/add')} variant="outline" />

      {store.plans.length > 0 && (
        <Card>
          <SwitchRow
            label={t('practice.heavyDay')}
            hint={t('practice.heavyDayHint')}
            value={heavy}
            onValueChange={toggleHeavy}
          />
        </Card>
      )}

      {store.plans.length > 0 && (
        <Card>
          <Body>{t('practice.ramadan')}</Body>
          {seasonPlans.length > 0 ? (
            <>
              <Body muted small>
                {t('practice.ramadanActive', { date: shortDate(seasonPlans[0]!.season!.until) })}
              </Body>
              <Button label={t('practice.ramadanEnd')} onPress={endRamadan} variant="outline" compact />
            </>
          ) : (
            <>
              <Body muted small>
                {season.inRamadan
                  ? t('practice.ramadanHint', { date: shortDate(season.until) })
                  : t('practice.ramadanHintNotRamadan', { date: shortDate(season.until) })}
              </Body>
              <Button label={t('practice.ramadanStart')} onPress={startRamadan} variant="outline" compact />
            </>
          )}
        </Card>
      )}

      <SectionTitle>{t('practice.reminders')}</SectionTitle>
      <Card>
        <SwitchRow
          label={t('practice.remindersSwitch')}
          hint={t('practice.remindersHint')}
          value={prefs.habitReminders}
          onValueChange={(v) => void toggleReminders(v)}
        />
      </Card>

      <SectionTitle>{t('practice.tools')}</SectionTitle>
      <Card>
        <LinkRow label={t('practice.duties.title')} onPress={() => router.push('/practice/duties')} />
        <LinkRow label={t('kinship.title')} onPress={() => router.push('/practice/kinship')} />
        <LinkRow label={t('sinProgram.title')} onPress={() => router.push('/practice/sin-program')} />
        <LinkRow label={t('calendar.title')} onPress={() => router.push('/practice/calendar')} />
      </Card>

      <Body small muted>
        {t('practice.privateNote')}
      </Body>
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

function TodayCard({
  plan,
  habit,
  reminderDay,
  amountLabel,
  onLog,
}: {
  plan: Plan;
  habit: CatalogHabit | undefined;
  reminderDay: boolean;
  amountLabel: (n: number) => string;
  onLog: (amount: number) => void;
}) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const view = planView(plan, today());
  const title = habit ? pick(habit, 'title', locale) : plan.title;

  return (
    <Pressable
      onPress={() => router.push(`/practice/plan/${plan.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, view.doneToday && styles.cardDone, pressed && { opacity: 0.85 }]}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={styles.title}>{title}</Text>
        {view.doneToday ? <Text style={styles.doneBadge}>{t('practice.doneToday')}</Text> : null}
      </Row>
      <Body>{t('practice.plan.required', { amount: amountLabel(view.required) })}</Body>
      {view.done > 0 && !view.doneToday ? (
        <Body muted small>
          {t('practice.plan.done', { amount: amountLabel(view.done) })}
        </Body>
      ) : null}
      <Row style={{ flexWrap: 'wrap' }}>
        {reminderDay ? <Text style={styles.tag}>{t('practice.reminderDay')}</Text> : null}
        {view.inEbb ? <Text style={styles.tag}>{t('practice.ebbActive')}</Text> : null}
        {view.inSeason && plan.season ? (
          <Text style={styles.tag}>{t('practice.seasonActive', { date: shortDate(plan.season.until) })}</Text>
        ) : null}
      </Row>
      <Row>
        <Button label={t('practice.logPlusOne')} onPress={() => onLog(1)} variant="outline" compact />
        {!view.doneToday ? (
          <Button label={t('practice.logRest')} onPress={() => onLog(view.remaining)} compact />
        ) : null}
      </Row>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing['4'],
    gap: Spacing['2'],
  },
  cardDone: { borderColor: Colors.success },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  doneBadge: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '700',
    backgroundColor: Colors.intentGoodDeedLight,
    paddingHorizontal: Spacing['2'],
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  tag: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing['2'],
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
});
