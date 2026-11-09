/**
 * «استراتيجيات العادات» (owner round 6, C-18 a: the reference's design — بناء / ترك / عودة, an example, then «طبّقها على
 * عادة»; our kit). One entry in «المزيد». Top to bottom:
 * - the filter «الكل · للبناء · للترك · للعودة» (src/lib/practice/strategies.ts `STRATEGY_GROUP`);
 * - one row per strategy (practice-core `STRATEGIES`, without «لا تفوّتها مرتين», which appears in its moment): its
 *   title and one idea line; «مثال وطريقة التطبيق» opens its example and its action:
 *   · building / returning: «طبّقها على عادة» → choose one of your habits → the habit-loop builder opens on that habit's
 *     loop with the strategy's question filled by the example (a written answer is never replaced); nothing is saved
 *     until the member reviews it and taps «احفظ الحلقة» (then a toast);
 *   · leaving: its own place («تخفَّف», «لحظة مجاهدة», or the short list of easy good deeds for «أتبع السيئة الحسنة»);
 * - «قبل أن تبدأ»: the educational cards, folded.
 * The weekly reminder of chosen strategies is set in «التنبيهات › الاستراتيجيات» (one setting, one place).
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { addHabitLoop, isPeriodicPlan, periodicActKeyOf, setHeartPrefs, updateHabitLoop, updatePlan, type Plan, type Strategy } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { draftOf, habitLoopInput, habitLoops, type LoopDraft } from '@/lib/practice/loops';
import { newPracticeId, usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import {
  STRATEGY_GROUPS,
  STRATEGY_GROUP,
  appliesToHabit,
  applyStrategyDraft,
  strategiesOf,
  strategyTarget,
  type StrategyGroup,
} from '@/lib/practice/strategies';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { ConsistencyCard, HabitLoopCard, SinStepsCard } from '@/components/practice/hub/KnowledgeCards';
import { EasyDeeds } from '@/components/practice/mujahada/EasyDeeds';
import { LoopBuilder } from '@/components/practice/loops/LoopBuilder';
import { space, useStyles, type Theme } from '@/theme';
import {
  BottomSheet,
  Button,
  ButtonPair,
  CheckRow,
  Icon,
  PageHeader,
  Screen,
  Section,
  SectionDivider,
  SegmentTabs,
  Text,
  toast,
  type SegmentItem,
} from '@/ui';

type Filter = StrategyGroup | 'all';

const makeStyles = (t: Theme) => ({
  cards: { gap: space.md },
  item: { gap: space.xs, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  itemLast: { borderBottomWidth: 0 },
  kicker: { flexDirection: 'row' as const },
  disclosure: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs, minHeight: 44, alignSelf: 'flex-start' as const },
  pressed: { opacity: 0.7 },
  body: { gap: space.md, paddingTop: space.xs },
  fold: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: 56 },
  foldTitle: { flex: 1, minWidth: 0 },
  options: { gap: space.sm },
});

export default function StrategiesScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [filter, setFilter] = useState<Filter>('all');
  const [cardsOpen, setCardsOpen] = useState(false);
  const [applying, setApplying] = useState<Strategy | null>(null);
  const tabs: SegmentItem<Filter>[] = [
    { key: 'all', label: t('practice.strategies.groups.all') },
    ...STRATEGY_GROUPS.map((g) => ({ key: g, label: t(`practice.strategies.groups.${g}`) })),
  ];
  const list = strategiesOf(filter);

  return (
    <Screen edges={['bottom']}>
      <PageHeader title={t('practice.strategies.title')} lead={t('practice.strategies.lead')} />
      <Section title={t('practice.strategies.oneIsEnough')}>
        <SegmentTabs items={tabs} value={filter} onChange={setFilter} />
        <View>
          {list.map((strategy, i) => (
            <StrategyItem key={strategy.key} strategy={strategy} last={i === list.length - 1} onApply={() => setApplying(strategy)} />
          ))}
        </View>
      </Section>
      <SectionDivider />
      <Pressable
        onPress={() => setCardsOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: cardsOpen }}
        style={({ pressed }) => [styles.fold, pressed && styles.pressed]}
      >
        <Text variant="heading" style={styles.foldTitle}>
          {t('practice.strategies.cardsTitle')}
        </Text>
        <Icon icon={cardsOpen ? ChevronUp : ChevronDown} size={18} tone="muted" />
      </Pressable>
      {cardsOpen ? (
        <View style={styles.cards}>
          <HabitLoopCard />
          <SinStepsCard withSource />
          <ConsistencyCard />
        </View>
      ) : null}
      <ApplyFlow strategy={applying} onClose={() => setApplying(null)} />
    </Screen>
  );
}

/** One strategy: title, idea, and «مثال وطريقة التطبيق» with the example and the action. */
function StrategyItem({ strategy, last, onApply }: { strategy: Strategy; last: boolean; onApply: () => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const [open, setOpen] = useState(false);
  const [deedsOpen, setDeedsOpen] = useState(false);
  const title = locale === 'en' ? strategy.titleEn : strategy.titleAr;
  const toHabit = appliesToHabit(strategy.key);
  const target = strategyTarget(strategy.action, strategy.key);
  const group = STRATEGY_GROUP[strategy.key] ?? 'build';

  function handleAction() {
    if (toHabit) {
      onApply();
      return;
    }
    if (target.kind === 'deeds') {
      setDeedsOpen((o) => !o);
      return;
    }
    if (target.heart) setHeart((h) => setHeartPrefs(h, target.heart ?? {}));
    router.push(target.href);
  }

  return (
    <View style={[styles.item, last && styles.itemLast]}>
      <Text variant="caption" tone="link">
        {t(`practice.strategies.groups.${group}`)}
      </Text>
      <Text variant="heading">{title}</Text>
      <Text variant="small" tone="muted">
        {t(`practice.strategies.items.${strategy.key}.idea`)}
      </Text>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${t('practice.strategies.howTo')}: ${title}`}
        style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
      >
        <Text variant="small" weight="medium" tone="link">
          {t('practice.strategies.howTo')}
        </Text>
        <Icon icon={open ? ChevronUp : ChevronDown} size={16} tone="link" />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Text variant="body">{`${t('practice.strategies.example')}: ${t(`practice.strategies.items.${strategy.key}.example`)}`}</Text>
          <Button
            label={
              toHabit
                ? t('practice.strategies.apply')
                : target.kind === 'deeds' && deedsOpen
                  ? t('practice.strategies.hideDeeds')
                  : t('practice.strategies.try')
            }
            icon={target.kind === 'deeds' && deedsOpen ? ChevronUp : undefined}
            arrow={!(target.kind === 'deeds' && deedsOpen)}
            onPress={handleAction}
            variant={target.kind === 'deeds' && deedsOpen ? 'outline' : 'solid'}
            size="sm"
          />
          {!toHabit && target.kind === 'deeds' && deedsOpen ? (
            <View style={{ gap: space.sm }}>
              <Text variant="small" tone="muted">
                {t('practice.strategies.deedsLead')}
              </Text>
              <EasyDeeds />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * «طبّقها على عادة»: choose a habit, then review its loop in the builder with the strategy's question filled. Saving
 * edits that habit's first loop (or adds one) through practice-core, so it syncs like any loop.
 */
function ApplyFlow({ strategy, onClose }: { strategy: Strategy | null; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const [draft, setDraft] = useState<LoopDraft | null>(null);
  // Habits only (a periodic act has no loop).
  const choices = useMemo(
    () => plans.filter((p) => periodicActKeyOf(p) === null && !isPeriodicPlan(p, { defaultRuleOf: (plan) => habitFor(plan, habits)?.defaultRule })),
    [plans, habits],
  );
  const titleOf = (plan: Plan) => {
    const habit = habitFor(plan, habits);
    return habit ? pick(habit, 'title', locale) : plan.title;
  };
  const plan = plans.find((p) => p.id === picked) ?? null;
  const loop = plan ? habitLoops(plan)[0] : undefined;

  function close() {
    setPicked(null);
    setDraft(null);
    onClose();
  }

  function next() {
    if (!strategy || !plan) return;
    setDraft(applyStrategyDraft(strategy.key, loop ? draftOf(loop) : {}, t(`practice.strategies.items.${strategy.key}.example`)));
  }

  function save(answers: LoopDraft) {
    if (!plan) return;
    const input = habitLoopInput(answers);
    setStore((s) => updatePlan(s, plan.id, (p) => (loop ? updateHabitLoop(p, loop.id, input) : addHabitLoop(p, newPracticeId(), input))));
    toast(t('practice.strategies.applied', { habit: titleOf(plan) }));
    close();
  }

  const title = strategy ? (locale === 'en' ? strategy.titleEn : strategy.titleAr) : '';
  return (
    <>
      <BottomSheet
        visible={strategy !== null && draft === null}
        title={t('practice.strategies.apply')}
        onClose={close}
        footer={
          choices.length > 0 ? (
            <ButtonPair
              size="lg"
              primary={{ label: t('practice.strategies.next'), onPress: next, disabled: !plan }}
              secondary={{ label: t('common.cancel'), onPress: close }}
            />
          ) : undefined
        }
      >
        <Text variant="small" tone="muted">
          {t('practice.strategies.pickHabit', { strategy: title })}
        </Text>
        {choices.length === 0 ? (
          <View style={styles.options}>
            <Text variant="body">{t('loops.habit.noHabits')}</Text>
            <Button
              label={t('practice.strategies.addHabit')}
              onPress={() => {
                close();
                router.push('/practice/add');
              }}
            />
          </View>
        ) : (
          <View style={styles.options} accessibilityRole="radiogroup">
            {choices.map((p) => (
              <CheckRow key={p.id} radio title={titleOf(p)} checked={picked === p.id} onPress={() => setPicked(p.id)} />
            ))}
          </View>
        )}
      </BottomSheet>
      <LoopBuilder
        kind="habit"
        visible={draft !== null}
        initial={draft ?? undefined}
        subject={plan ? titleOf(plan) : undefined}
        editing={Boolean(loop)}
        onClose={close}
        onSave={save}
      />
    </>
  );
}
