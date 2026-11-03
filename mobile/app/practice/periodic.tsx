/**
 * «أعمال دورية»: every act that does not repeat each day, soonest first: people (each list is one act; added and
 * edited on its people screen) and the dated acts (each opens its plan). «أضف عملًا دوريًا» lists the catalog
 * templates (practice-core limits: 7 periodic acts; past it the limit sheet). Reached from «ورد اليوم» and «سجلّي».
 */

import React, { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus, Repeat, Users } from 'lucide-react-native';
import { upsertPlan } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick, type CatalogHabit } from '@/lib/practice/catalog-types';
import { planFromHabit } from '@/lib/practice/plan-view';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { useLimits, usePeriodicRows } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { LimitSheet } from '@/components/practice/LimitSheet';
import { PeriodicRows } from '@/components/practice/hub/PeriodicRows';
import { Button, EmptyState, ListRow, PageHeader, Screen, Section, Text } from '@/ui';

/** Active days a periodic act aims for (the practice-core minimum: its rule decides its days). */
const PERIODIC_ACTIVE_DAYS = 2;

export default function PeriodicScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const catalog = usePracticeCatalog(locale);
  const rows = usePeriodicRows(today());
  const planLimits = useLimits();
  const [limitOpen, setLimitOpen] = useState(false);

  const relatives = rows.filter((r) => r.act.kind === 'relative');
  const habits = rows.filter((r) => r.act.kind === 'habit');
  const periodic = (catalog.data?.habits ?? []).filter((h) => h.kind === 'periodic');
  const templates = [...periodic.filter((h) => h.people), ...periodic.filter((h) => !h.people)];
  const added = new Set(plans.map((p) => p.habitKey));

  function addTemplate(habit: CatalogHabit) {
    if (habit.people) {
      router.push({ pathname: '/practice/kinship', params: { circle: habit.people } });
      return;
    }
    if (!planLimits.canAdd('periodic')) {
      setLimitOpen(true);
      return;
    }
    const plan = planFromHabit({
      id: newPracticeId(),
      habit,
      amount: habit.start.near,
      slots: [...habit.defaultSlots].sort(),
      activeDaysPerWeek: PERIODIC_ACTIVE_DAYS,
      rule: habit.defaultRule,
      today: today(),
      locale,
    });
    setStore((s) => upsertPlan(s, plan));
  }

  return (
    <Screen edges={['bottom']}>
      <PageHeader title={t('practice.periodic.title')} lead={t('practice.periodic.lead')} />

      {hydrated && rows.length === 0 ? <EmptyState icon={Repeat} message={t('practice.periodic.empty')} /> : null}

      {relatives.length > 0 ? (
        <Section
          title={t('practice.periodic.people')}
          action={<Button label={t('practice.periodic.manageKinship')} variant="outline" compact arrow onPress={() => router.push('/practice/kinship')} />}
        >
          <PeriodicRows rows={relatives} />
        </Section>
      ) : null}

      {habits.length > 0 ? (
        <Section title={t('practice.periodic.habitsTitle')}>
          <PeriodicRows rows={habits} />
        </Section>
      ) : null}

      <Section title={t('practice.periodic.add')}>
        <Text variant="small" tone="muted">
          {t('practice.periodic.count', { n: planLimits.periodic.count, max: planLimits.periodic.max })}
        </Text>
        {templates.map((habit) => (
          <ListRow
            key={habit.key}
            icon={habit.people ? Users : Plus}
            title={pick(habit, 'title', locale)}
            value={!habit.people && added.has(habit.key) ? t('practice.periodic.added') : undefined}
            onPress={!habit.people && added.has(habit.key) ? undefined : () => addTemplate(habit)}
          />
        ))}
      </Section>

      <LimitSheet kind="periodic" visible={limitOpen} limits={planLimits} onClose={() => setLimitOpen(false)} onFreed={() => setLimitOpen(false)} />
    </Screen>
  );
}
