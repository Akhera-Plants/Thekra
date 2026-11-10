/**
 * «استراتيجيات العادات» (owner round 6, C-18 a: the reference's design — بناء / ترك / عودة, an example, then «طبّقها على
 * عادة»; our kit). One entry in «المزيد». Top to bottom:
 * - the filter «الكل · للبناء · للترك · للعودة» (practice-core `STRATEGY_KINDS`, the same families as the website);
 * - one row per strategy (practice-core `listedStrategies`, without «لا تفوّتها مرتين», which appears in its moment): its
 *   title, one idea line and «ذكّرني بها» (the weekly strategy reminder, the same list as «التنبيهات › الاستراتيجيات»,
 *   whose day and time are set there); «مثال وطريقة التطبيق» opens its example and its action:
 *   · building / returning: «طبّقها على عادة» → choose one of your habits → the habit-loop builder opens on that habit's
 *     loop with the strategy's question filled by the example (a written answer is never replaced); nothing is saved
 *     until the member reviews it and taps «احفظ الحلقة» (then a toast);
 *   · leaving: its own place («تخفَّف», «لحظة مجاهدة», or the short list of easy good deeds for «أتبع السيئة الحسنة»);
 * - «قبل أن تبدأ»: the educational cards, folded.
 * The weekly reminder's day and time are set in «التنبيهات › الاستراتيجيات».
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bell, BellRing, ChevronDown, ChevronUp } from 'lucide-react-native';
import {
  applyStrategyToPlan,
  FARD_LABELS,
  isArchived,
  isPeriodicPlan,
  listedStrategies,
  MAX_LOOP_TEXT,
  periodicActKeyOf,
  setHeartPrefs,
  STRATEGY_KINDS,
  strategyApplyField,
  toggleStrategy,
  updatePlan,
  type Plan,
  type Strategy,
  type StrategyKind,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { newPracticeId, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount, habitFor } from '@/lib/practice/reminders';
import { ensurePermission } from '@/lib/practice/notifications';
import { appliesToHabit, applySuggestion, quoted, strategyTarget } from '@/lib/practice/strategies';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { ConsistencyCard, HabitLoopCard, SinStepsCard } from '@/components/practice/hub/KnowledgeCards';
import { EasyDeeds } from '@/components/practice/mujahada/EasyDeeds';
import { space, useStyles, type Theme } from '@/theme';
import {
  BottomSheet,
  Button,
  ButtonPair,
  CheckRow,
  Field,
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

type Filter = StrategyKind | 'all';

const makeStyles = (t: Theme) => ({
  cards: { gap: space.md },
  item: { gap: space.xs, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  itemLast: { borderBottomWidth: 0 },
  kicker: { flexDirection: 'row' as const },
  head: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.sm },
  headText: { flex: 1, minWidth: 0, gap: space.xs },
  remind: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, minHeight: 44, paddingHorizontal: space.xs },
  disclosure: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs, minHeight: 44, alignSelf: 'flex-start' as const },
  pressed: { opacity: 0.7 },
  body: { gap: space.md, paddingTop: space.xs },
  action: { flexDirection: 'row' as const, paddingTop: space.xs },
  fold: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: 56 },
  foldTitle: { flex: 1, minWidth: 0 },
  options: { gap: space.sm },
  multiline: { minHeight: 88, textAlignVertical: 'top' as const, paddingTop: space.sm },
});

export default function StrategiesScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [filter, setFilter] = useState<Filter>('all');
  const [cardsOpen, setCardsOpen] = useState(false);
  const [applying, setApplying] = useState<Strategy | null>(null);
  const tabs: SegmentItem<Filter>[] = [
    { key: 'all', label: t('practice.strategies.groups.all') },
    ...STRATEGY_KINDS.map((g) => ({ key: g, label: t(`practice.strategies.groups.${g}`) })),
  ];
  const list = listedStrategies(filter);

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
  const reminded = usePracticeStore((s) => s.prefs.weeklyStrategies.includes(strategy.key));
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [open, setOpen] = useState(false);
  const [deedsOpen, setDeedsOpen] = useState(false);
  const title = locale === 'en' ? strategy.titleEn : strategy.titleAr;
  const toHabit = appliesToHabit(strategy.key);
  const target = strategyTarget(strategy.action, strategy.key);
  const group = strategy.kind;

  /** «ذكّرني بها» (the same switch as «التنبيهات › الاستراتيجيات»; turning it on asks for the permission first). */
  async function toggleReminder() {
    const on = !reminded;
    if (on && !(await ensurePermission(t('practice.notify.channelName')))) {
      toast({ message: t('practice.permissionDenied'), tone: 'info' });
      return;
    }
    setPrefs((p) => ({ ...p, weeklyStrategies: toggleStrategy(p.weeklyStrategies, strategy.key) }));
    toast(on ? t('practice.strategies.reminderOn') : t('practice.strategies.reminderOff'));
  }

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
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text variant="caption" tone="link">
            {t(`practice.strategies.groups.${group}`)}
          </Text>
          <Text variant="heading">{title}</Text>
          <Text variant="small" tone="muted">
            {t(`practice.strategies.items.${strategy.key}.idea`)}
          </Text>
        </View>
        <Pressable
          onPress={() => void toggleReminder()}
          accessibilityRole="switch"
          accessibilityState={{ checked: reminded }}
          accessibilityLabel={t('practice.strategies.remindA11y', { title })}
          style={({ pressed }) => [styles.remind, pressed && styles.pressed]}
        >
          <Icon icon={reminded ? BellRing : Bell} size={18} tone={reminded ? 'link' : 'muted'} />
          <Text variant="caption" tone={reminded ? 'link' : 'muted'}>
            {t('practice.strategies.remind')}
          </Text>
        </Pressable>
      </View>
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
        </View>
      ) : null}
      {/* The action sits on the card like the website's (round 7, QA): «طبّقها على عادة» / «جرّبها», not only in the example. */}
      <View style={styles.action}>
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
          variant="outline"
          size="sm"
        />
      </View>
      {!toHabit && target.kind === 'deeds' && deedsOpen ? (
        <View style={{ gap: space.sm }}>
          <Text variant="small" tone="muted">
            {t('practice.strategies.deedsLead')}
          </Text>
          <EasyDeeds />
        </View>
      ) : null}
    </View>
  );
}

/**
 * «طبّقها على عادة» (round 7, C2; the website's flow): choose a habit, then the ONE question of its loop the strategy
 * answers, asked about that habit, with an answer built from the habit when it says something (lib `applySuggestion`).
 * «احفظ في حلقة العادة» writes it into the habit's first loop through practice-core `applyStrategyToPlan` (synced like
 * any loop); an answer it replaces is shown first.
 */
function ApplyFlow({ strategy, onClose }: { strategy: Strategy | null; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState('');
  // Habits only (a periodic act has no loop).
  const choices = useMemo(
    () => plans.filter((p) => !isArchived(p) && periodicActKeyOf(p) === null && !isPeriodicPlan(p, { defaultRuleOf: (plan) => habitFor(plan, habits)?.defaultRule })),
    [plans, habits],
  );
  const unitFallback = { minutes: t('practice.units.minutes'), count: t('practice.units.count'), times: t('practice.units.times') };
  const titleOf = (plan: Plan) => {
    const habit = habitFor(plan, habits);
    return habit ? pick(habit, 'title', locale) : plan.title;
  };
  const amountOf = (plan: Plan) => (n: number) => formatAmount(n, plan.unit, habitFor(plan, habits), locale, unitFallback);
  const plan = choices.find((p) => p.id === picked) ?? (choices.length === 1 ? choices[0] : undefined);
  const field = strategy ? strategyApplyField(strategy.key) : null;
  const current = plan && field ? (plan.loops?.[0]?.[field] ?? '').trim() : '';
  const replacing = current !== '' && text.trim() !== current;

  function startFor(next: Plan | undefined) {
    if (!strategy || !next || !field) {
      setText('');
      return;
    }
    const suggestion = applySuggestion(
      strategy.key,
      next,
      { amount: amountOf(next), prayer: (p) => FARD_LABELS[locale].prayers[p] },
      (key, values) => t(`practice.strategies.${key}`, values),
    );
    setText(suggestion || (next.loops?.[0]?.[field] ?? '').trim());
  }

  // Opening the sheet (or a single habit) starts from that habit's own answer.
  const [opened, setOpened] = useState<string | null>(null);
  const openKey = strategy && plan ? `${strategy.key}-${plan.id}` : null;
  if (openKey !== opened) {
    setOpened(openKey);
    startFor(plan);
  }

  function close() {
    setPicked(null);
    setText('');
    setOpened(null);
    onClose();
  }

  function save() {
    if (!strategy || !plan || !text.trim()) return;
    const amount = amountOf(plan);
    setStore((s) =>
      updatePlan(s, plan.id, (p) => applyStrategyToPlan(p, strategy.key, text, { loopId: newPracticeId(), routine: `${titleOf(p)}: ${amount(p.amount)}` })),
    );
    toast(t('practice.strategies.applied', { habit: quoted(titleOf(plan), locale === 'en') }));
    close();
  }

  const title = strategy ? (locale === 'en' ? strategy.titleEn : strategy.titleAr) : '';
  return (
    <BottomSheet
      visible={strategy !== null}
      title={title}
      onClose={close}
      footer={
        choices.length > 0 ? (
          <ButtonPair
            size="lg"
            primary={{ label: t('practice.strategies.saveApply'), onPress: save, disabled: !plan || !text.trim() }}
            secondary={{ label: t('common.cancel'), onPress: close }}
          />
        ) : undefined
      }
    >
      {strategy ? (
        <Text variant="small" tone="muted">
          {t(`practice.strategies.items.${strategy.key}.idea`)}
        </Text>
      ) : null}
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
        <>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={t('practice.strategies.chooseHabit')}>
            <Text variant="label">{t('practice.strategies.chooseHabit')}</Text>
            {choices.map((p) => (
              <CheckRow key={p.id} radio title={titleOf(p)} checked={plan?.id === p.id} onPress={() => setPicked(p.id)} />
            ))}
          </View>
          {plan && strategy && field ? (
            <>
              <SectionDivider />
              <View style={styles.options}>
                <Text variant="heading">{t(`practice.strategies.items.${strategy.key}.ask`, { habit: quoted(titleOf(plan), locale === 'en') })}</Text>
                <Text variant="caption" tone="muted">
                  {t('practice.strategies.savedIn', { field: t(`loops.habit.steps.${field}.label`) })}
                </Text>
                <Field
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={MAX_LOOP_TEXT}
                  placeholder={t(`practice.strategies.items.${strategy.key}.example`)}
                  accessibilityLabel={t(`practice.strategies.items.${strategy.key}.ask`, { habit: quoted(titleOf(plan), locale === 'en') })}
                  style={styles.multiline}
                />
                {replacing ? (
                  <Text variant="small" tone="muted">
                    {t('practice.strategies.replaces', { text: current })}
                  </Text>
                ) : null}
              </View>
            </>
          ) : null}
        </>
      )}
    </BottomSheet>
  );
}
