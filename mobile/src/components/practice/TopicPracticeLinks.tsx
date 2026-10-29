/**
 * The bridges from a topic page to the practice tools (owner: «at every good deed, the option to make it a habit;
 * at every sin, to start leaving it»), read from the practice catalog the hub already caches:
 * - `DeedHabits`: «اجعلها عادة» on a good deed, one row per catalog habit of that deed, each opening «أضف عادة»
 *   with the habit preselected, or its plan when it is already a habit;
 * - `SinProgramLink`: «ابدأ برنامج الترك» / «تابع برنامجك» on a sin. The sin goes to the chooser in memory
 *   (`setPendingProgram`), never in the route (roadmap §0.2).
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { isActiveProgram } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick, type CatalogHabit } from '@/lib/practice/catalog-types';
import { setPendingProgram, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { space, useStyles, type Theme } from '@/theme';
import { Button, NextStep, Text, TextLink } from '@/ui';

const makeStyles = (t: Theme) => ({
  body: { gap: space.sm },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  rowText: { flex: 1, gap: 2 },
  program: { gap: space.xs },
});

/** «اجعلها عادة»: the catalog habits that lead to this deed; a quiet «أعِنّي على طاعة» when there are none. */
export function DeedHabits({ deed }: { deed: string }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const catalog = usePracticeCatalog(locale);
  const plans = usePracticeStore((s) => s.store.plans);

  if (!catalog.data) return null;
  const habits = catalog.data.habits.filter((h) => h.deed === deed);
  if (habits.length === 0) {
    return <TextLink label={t('practice.add.title')} onPress={() => router.push('/practice/add')} muted />;
  }

  // Plan ids are UUIDs; the catalog habit is `habitKey`.
  const planByHabit = new Map(plans.map((p) => [p.habitKey ?? p.id, p.id]));
  return (
    <NextStep title={t('motivations.habitTitle')}>
      <View style={styles.body}>
        <Text variant="small">{t('motivations.habitLead')}</Text>
        {habits.map((habit) => (
          <DeedHabitRow key={habit.key} habit={habit} planId={planByHabit.get(habit.key)} />
        ))}
      </View>
    </NextStep>
  );
}

function DeedHabitRow({ habit, planId }: { habit: CatalogHabit; planId: string | undefined }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const unitFallback = {
    minutes: t('practice.units.minutes'),
    count: t('practice.units.count'),
    times: t('practice.units.times'),
  };
  const timeHint = pick(habit, 'timeHint', locale);
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text variant="body" weight="medium">
          {pick(habit, 'title', locale)}
        </Text>
        {timeHint ? (
          <Text variant="caption" tone="muted">
            {t('practice.add.timeHint', { hint: timeHint })}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted">
          {t('practice.add.startAmount', { amount: formatAmount(habit.start.far, habit.unit, habit, locale, unitFallback) })}
        </Text>
      </View>
      {planId ? (
        <TextLink label={t('practice.add.alreadyAdded')} onPress={() => router.push(`/practice/plan/${planId}`)} />
      ) : (
        <Button
          label={t('motivations.habitStart')}
          variant="outline"
          arrow
          onPress={() => router.push({ pathname: '/practice/add', params: { habit: habit.key } })}
        />
      )}
    </View>
  );
}

/**
 * «ابدأ برنامج الترك» when the catalog has a program for this sin, «تابع برنامجك» when it is the active one. While
 * another program is active it is still offered: the chooser opens with this sin selected, and starting it there
 * ends the current one after a confirmation (the app keeps one program at a time).
 */
export function SinProgramLink({ sin }: { sin: string }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const catalog = usePracticeCatalog(locale);
  const active = usePracticeStore((s) => s.store.programs.find(isActiveProgram));

  const hasProgram = catalog.data?.sinPrograms.programs.some((p) => p.sin === sin) ?? false;
  if (!hasProgram) return null;
  const isActive = active?.sinSlug === sin;

  function handleOpen() {
    if (!isActive) setPendingProgram(sin);
    router.push('/practice/sin-program');
  }

  return (
    <View style={styles.program}>
      <Button
        label={isActive ? t('reminders.continueProgram') : t('reminders.startProgram')}
        variant="outline"
        arrow
        onPress={handleOpen}
      />
      <Text variant="caption" tone="muted">
        {t('practice.hub.addProgramHint')}
      </Text>
    </View>
  );
}
