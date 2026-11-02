/**
 * «ابنِ حلقة عادتك الخاصة» (owner round 3, item 17), from «عاداتي» and the strategies page: pick one of your habits
 * (chips; `?plan=` preselects one), then its loops (several per habit) as clear loop cards with edit and delete, and
 * «أضف حلقة» opens the stepper (one question per step). Saved on the plan (`loops`, practice-core `addHabitLoop` /
 * `updateHabitLoop` / `removeHabitLoop`), so it syncs with the account like the rest of the plan.
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus, Repeat } from 'lucide-react-native';
import { addHabitLoop, isPaused, removeHabitLoop, updateHabitLoop, updatePlan, type Plan } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { habitLoopInput, habitLoops } from '@/lib/practice/loops';
import { newPracticeId, usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { HabitLoopCard } from '@/components/practice/hub/KnowledgeCards';
import { LoopsPanel } from '@/components/practice/loops/LoopsPanel';
import { space, useStyles } from '@/theme';
import { Chip, EmptyState, Ornament, PageHeader, Screen, Section, Wrap } from '@/ui';

const makeStyles = () => ({
  block: { gap: space.md },
});

export default function HabitLoopsScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const params = useLocalSearchParams<{ plan?: string }>();
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const live = useMemo(() => plans.filter((p) => !isPaused(p)), [plans]);
  const [picked, setPicked] = useState<string | null>(params.plan ?? null);
  const plan = live.find((p) => p.id === picked) ?? (live.length === 1 ? live[0] : undefined);
  const titleOf = (p: Plan) => {
    const habit = habitFor(p, habits);
    return habit ? pick(habit, 'title', locale) : p.title;
  };
  const edit = (change: (p: Plan) => Plan) => {
    if (!plan) return;
    setStore((s) => updatePlan(s, plan.id, change));
  };

  return (
    <Screen edges={['bottom']} decor>
      <PageHeader title={t('loops.habit.pageTitle')} lead={t('loops.habit.pageLead')} />
      <HabitLoopCard />
      <Ornament />
      {live.length === 0 ? (
        <EmptyState
          icon={Repeat}
          message={t('loops.habit.noHabits')}
          actionLabel={t('practice.addHabit')}
          onAction={() => router.push('/practice/add')}
        />
      ) : (
        <>
          <Section title={t('loops.habit.pick')}>
            <Wrap>
              {live.map((p) => (
                <Chip
                  key={p.id}
                  label={titleOf(p)}
                  selected={plan?.id === p.id}
                  count={habitLoops(p).length || undefined}
                  onPress={() => setPicked(p.id)}
                />
              ))}
            </Wrap>
          </Section>
          {plan ? (
            <View style={styles.block}>
              <Section title={titleOf(plan)}>
                <LoopsPanel
                  kind="habit"
                  loops={habitLoops(plan)}
                  subject={titleOf(plan)}
                  onAdd={(draft) => edit((p) => addHabitLoop(p, newPracticeId(), habitLoopInput(draft)))}
                  onUpdate={(id, draft) => edit((p) => updateHabitLoop(p, id, habitLoopInput(draft)))}
                  onRemove={(id) => edit((p) => removeHabitLoop(p, id))}
                />
              </Section>
            </View>
          ) : (
            <EmptyState icon={Plus} message={t('loops.habit.pickHint')} />
          )}
        </>
      )}
    </Screen>
  );
}
