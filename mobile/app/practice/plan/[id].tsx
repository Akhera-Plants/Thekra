/**
 * The habit page (owner round 6, §3; C-02e a, C-27 a, C-01b; the reference's layout, our kit). Logging and a day note
 * ARE here (the owner overrides F-31).
 * - A tinted head card: today's amount, its days and times and «القدر الأدنى», «تعديل العادة» on its line (round 7, C3:
 *   times, days, amount and minimum in ONE sheet; the minimum is not repeated lower down); the header «⋯» holds «أرشِف» (with
 *   the 3-day note) and «احذف» (confirmed). An archived habit says so and offers «أعِدها» (archive = the old pause).
 * - Reference tabs «المتابعة · حلقة العادة · التذكيرات · العودة بعد انقطاع» (`?tab=follow|loop|reminders|return`):
 *   - المتابعة: today's log (the whole amount, «+1», a typed part, «صحّح السجل»), the day note and the two optional
 *     questions «ما الذي أعانك على الالتزام؟» / «ما الذي صعّب عليك؟» (practice-core `setReflection`, shown in «سجلّي»),
 *     the completion and its milestones, «آخر 30 يومًا» (a day opens what was logged and written on it, round 7 C4),
 *     «زِد خطوة» / the lighter step when due, and «آيات وأحاديث تعينك على هذه الطاعة»;
 *   - حلقة العادة: the member's loops (own form; the two answers of «أضف» are its first loop);
 *   - التذكيرات: the times and days, edited in ONE sheet, the deed-window fix, and the link to «التنبيهات»;
 *   - العودة بعد انقطاع: «صلّحها» when the gap condition holds (the make-up good deed after two missed days), the
 *     lighter restart, and what the member wrote was hard (learn from the slip).
 * Sections are divided by the flower divider; every save toasts.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Archive, BellRing, PencilLine, RotateCcw, SearchX, Trash2 } from 'lucide-react-native';
import {
  addHabitLoop,
  ANCHOR_LABELS,
  archiveNote,
  correctLog,
  decreaseTo,
  deletePlan,
  establishPlan,
  graduationReady,
  habitCompletion,
  habitMilestones,
  increase,
  isArchived,
  isCustomPeriodic,
  isPrayerAnchor,
  logForDay,
  makeUpOffer,
  minimumOf,
  missedDayBefore,
  normalize,
  orderedSlots,
  pendingAsks,
  reflectionOf,
  reflectionsOfPlan,
  REFLECTION_TEXT_MAX,
  removeHabitLoop,
  restorePlanInStore,
  setReflection,
  shareSuggestion,
  slotChoices,
  updateHabitLoop,
  updatePlan,
  type Plan,
} from '@thekra/practice-core';
import { useDisplayTime } from '@/components/practice/editors';
import { fixedChoices, unsuitableChoices, windowRange } from '@/lib/practice/deed-window';
import { currentPrayerDay } from '@/lib/practice/prayer';
import { useMyCircles } from '@/lib/api/circles';
import { useEvidence, usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { ruleToWeekdays } from '@/lib/practice/format';
import { mendState, showsMend } from '@/lib/practice/habits-view';
import { archiveLine, milestoneLines, restoreToastKey } from '@/lib/practice/hub-view';
import { habitLoopInput } from '@/lib/practice/loops';
import { planView } from '@/lib/practice/plan-view';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount, habitFor, planRule } from '@/lib/practice/reminders';
import { useDateNames, useLimits, usePlanDays, useShortDate } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useAuthStore } from '@/lib/stores/auth-store';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { HabitFixSheet } from '@/components/practice/HabitFixSheet';
import { MonthPanel } from '@/components/practice/PlanHistoryAndSettings';
import { PlanEditSheet } from '@/components/practice/PlanEditSheet';
import { TodayPanel } from '@/components/practice/PlanTodayCard';
import { ArchiveSheet } from '@/components/practice/habits/HabitActions';
import { PendingAsks } from '@/components/practice/habits/TodayTab';
import { ruleWords } from '@/components/practice/habits/PeriodicTab';
import { LoopsPanel } from '@/components/practice/loops/LoopsPanel';
import { radius, space, useStyles, type Theme } from '@/theme';
import {
  ActionMenu,
  Button,
  ButtonPair,
  EmptyState,
  Field,
  ListRow,
  Loading,
  NextStep,
  Notice,
  Screen,
  Section,
  SectionDivider,
  Text,
  UnderlineTabs,
  Wrap,
  toast,
} from '@/ui';

const TABS = ['follow', 'loop', 'reminders', 'return'] as const;
type Tab = (typeof TABS)[number];
const parseTab = (raw: unknown): Tab => (TABS as readonly string[]).includes(raw as string) ? (raw as Tab) : 'follow';

const makeStyles = (t: Theme) => ({
  head: { gap: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: t.colors.primarySoft },
  headTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  stack: { gap: space.md },
  offerActions: { marginTop: space.sm },
  answer: { gap: 2, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  answerLast: { borderBottomWidth: 0 },
  multiline: { minHeight: 88, textAlignVertical: 'top' as const, paddingTop: space.sm },
});

export default function PlanScreen() {
  const shortDate = useShortDate();
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const id = params.id;
  const { t, i18n } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const store = usePracticeStore((s) => s.store);
  const plan = store.plans.find((p) => p.id === id);
  const setStore = usePracticeStore((s) => s.setStore);
  const catalog = usePracticeCatalog(locale);
  const habits = catalog.data?.habits ?? [];
  const habit = plan ? habitFor(plan, habits) : undefined;
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const show = useDisplayTime();
  const names = useDateNames();
  const limits = useLimits();
  const [tab, setTab] = useState<Tab>(parseTab(params.tab));
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  if (!hydrated) return <Loading />;
  if (!plan) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} message={t('practice.plan.notFound')} actionLabel={t('common.back')} onAction={() => router.back()} />
      </Screen>
    );
  }

  const d = today();
  const view = planView(plan, d);
  const unitFallback = { minutes: t('practice.units.minutes'), count: t('practice.units.count'), times: t('practice.units.times') };
  const amountLabel = (n: number) => formatAmount(n, plan.unit, habit, locale, unitFallback);
  const title = habit ? pick(habit, 'title', locale) : plan.title;
  const archived = isArchived(plan);
  const weekdays = ruleToWeekdays(planRule(plan, habits));
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  const rule = planRule(plan, habits);
  const slotWords = slotChoices(plan).map((s) => (isPrayerAnchor(s) ? ANCHOR_LABELS[lang][s] : show(s)));
  const schedule = [rule ? ruleWords(rule, t, locale, names.weekday) : null, slotWords.join(lang === 'ar' ? '، ' : ', ')].filter(Boolean).join(' · ');
  // A periodic act is a reminder, not a commitment (C-10 / C-17): no minimum. Round 7 (C3): the minimum is shown here,
  // in the head, and edited from «تعديل العادة» only.
  const periodicAct = isCustomPeriodic(plan) || habit?.kind === 'periodic';
  const headLine = periodicAct ? schedule : [schedule, t('habitsHub.minimum.headLine', { amount: amountLabel(minimumOf(plan)) })].filter(Boolean).join(' · ');

  function update(fn: (p: Plan) => Plan) {
    setStore((s) => updatePlan(s, id as string, fn));
  }

  function handleRestore() {
    if (!limits.canAdd('sapling')) {
      toast(t('habitsHub.archive.restoreFull', { max: 3 }));
      return;
    }
    let reset = false;
    setStore((s) => {
      const r = restorePlanInStore(s, id as string, d);
      reset = r.reset;
      return r.store;
    });
    toast(t(restoreToastKey(reset), { habit: title }));
  }

  function handleRemove() {
    setStore((s) => deletePlan(s, id as string));
    router.back();
    toast(t('practice.plan.deleted'));
  }

  const renderMenu = () => (
    <ActionMenu
      items={[
        { label: t('habitsHub.plan.editHabit'), icon: PencilLine, onPress: () => setEditing(true) },
        archived
          ? { label: t('habitsHub.archive.restore'), icon: RotateCcw, onPress: handleRestore }
          : { label: t('habitsHub.archive.action'), icon: Archive, hint: t('habitsHub.archive.menuHint'), onPress: () => setArchiving(true) },
        {
          label: t('practice.plan.delete'),
          icon: Trash2,
          destructive: true,
          onPress: handleRemove,
          confirm: {
            title: t('habitsHub.habits.deleteTitle', { habit: title }),
            message: t(signedIn ? 'practice.plan.deleteConfirmSynced' : 'practice.plan.deleteConfirm'),
            confirmLabel: t('common.delete'),
          },
        },
      ]}
    />
  );
  const archiveInfo = archived ? archiveLine(archiveNote(plan, d)) : null;
  // A periodic act keeps «المتابعة» and «التذكيرات» only — no habit loop, no «العودة بعد انقطاع», no daily questions.
  const tabs: readonly Tab[] = periodicAct ? ['follow', 'reminders'] : TABS;
  const shownTab: Tab = tabs.includes(tab) ? tab : 'follow';

  return (
    <Screen edges={['bottom']} keyboard>
      <Stack.Screen options={{ title, headerRight: renderMenu }} />
      <Text variant="display" accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.head}>
        <View style={styles.headTop}>
          <View style={styles.grow}>
            <Text variant="title">{amountLabel(view.required)}</Text>
            <Text variant="small" tone="muted">
              {headLine}
            </Text>
          </View>
          <Button label={t('habitsHub.plan.editHabit')} icon={PencilLine} variant="outline" size="sm" onPress={() => setEditing(true)} />
        </View>
        {archived && archiveInfo ? (
          <>
            <Text variant="small">
              {`${t('habitsHub.archive.since', { date: shortDate(plan.pausedOn ?? d) })} · ${t(archiveInfo.key, { ...archiveInfo.params, date: archiveInfo.params.date ? shortDate(String(archiveInfo.params.date)) : undefined })}`}
            </Text>
            <Button label={t('habitsHub.archive.restore')} icon={RotateCcw} onPress={handleRestore} />
          </>
        ) : null}
      </View>

      <UnderlineTabs items={tabs.map((key) => ({ key, label: t(`habitsHub.plan.tabs.${key}`) }))} value={shownTab} onChange={setTab} accessibilityLabel={title} />

      {shownTab === 'follow' ? (
        <FollowTab plan={plan} title={title} amountLabel={amountLabel} archived={archived} periodicAct={periodicAct} />
      ) : shownTab === 'loop' ? (
        <LoopTab plan={plan} title={title} />
      ) : shownTab === 'reminders' ? (
        <RemindersTab plan={plan} title={title} schedule={schedule} onEdit={() => setEditing(true)} />
      ) : (
        <ReturnTab plan={plan} title={title} amountLabel={amountLabel} />
      )}

      <PlanEditSheet
        visible={editing}
        plan={plan}
        title={title}
        today={d}
        amountLabel={amountLabel}
        withAmounts={!periodicAct}
        window={habit?.window}
        ruleWeekdays={weekdays}
        onClose={() => setEditing(false)}
        onSave={(next) => {
          update(() => next);
          setEditing(false);
          toast(t('practice.plan.settingsSaved'));
        }}
      />
      <ArchiveSheet plan={plan} title={title} today={d} visible={archiving} onClose={() => setArchiving(false)} onDone={() => router.back()} />
    </Screen>
  );
}

interface TabProps {
  plan: Plan;
  title: string;
}

function FollowTab({ plan, title, amountLabel, archived, periodicAct }: TabProps & { amountLabel: (n: number) => string; archived: boolean; periodicAct: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const habit = habitFor(plan, habits);
  const evidence = useEvidence(habit?.evidence ?? [], locale);
  const inCircle = (useMyCircles().data?.length ?? 0) > 0;
  const [fixing, setFixing] = useState(false);
  const [relapseDismissed, setRelapseDismissed] = useState(false);
  const d = today();
  const view = planView(plan, d);
  const completion = habitCompletion(plan, d);
  const lines = milestoneLines(habitMilestones(plan, d), shareSuggestion(plan, d), inCircle);
  const update = (fn: (p: Plan) => Plan) => setStore((s) => updatePlan(s, plan.id, fn));
  const unitLabel = habit ? pick(habit, 'unitLabel', locale) || t(`practice.units.${plan.unit}`) : t(`practice.units.${plan.unit}`);
  return (
    <>
      {!archived ? (
        <TodayPanel
          plan={plan}
          view={view}
          today={d}
          amountLabel={amountLabel}
          unitLabel={unitLabel}
          fixing={fixing}
          onLog={(amount) => {
            update((p) => logForDay(p, d, amount, today()));
            toast(t('practice.plan.logged'));
          }}
          onFixOpen={() => setFixing(true)}
          onFixSave={(date, amount) => {
            update((p) => correctLog(p, date, amount));
            setFixing(false);
            toast(t('practice.plan.fixSaved'));
          }}
          onFixCancel={() => setFixing(false)}
        />
      ) : null}

      {periodicAct ? null : (
        <>
          <ReflectionForm plan={plan} />

        </>
      )}

      <SectionDivider />
      {periodicAct ? null : (
      <Section title={t('habitsHub.plan.progress')}>
        <Text variant="body">{t('habitsHub.habits.completionLine', { percent: completion.percent, kept: Math.min(completion.keptDays, completion.targetDays), target: completion.targetDays })}</Text>
        {lines.map((key) => (
          <Text key={key} variant="small" tone="link" onPress={key === 'habitsHub.habits.share' ? () => router.push('/circles') : undefined}>
            {t(key)}
          </Text>
        ))}
      </Section>
      )}
      <MonthPanel plan={plan} view={view} today={d} />

      {!periodicAct && graduationReady(plan, d) ? (
        <NextStep title={t('practice.graduation.offer')}>
          <Wrap style={styles.offerActions}>
            <Button
              label={t('practice.graduation.action')}
              variant="outline"
              onPress={() => {
                update((p) => establishPlan(p, d));
                toast(t('habitsTab.record.establishedToast'));
              }}
            />
          </Wrap>
        </NextStep>
      ) : null}

      {!periodicAct && !archived && view.canIncrease && view.nextAmount !== null ? (
        <NextStep title={t('practice.increase.title')}>
          <Text variant="small">{t('practice.increase.body', { amount: amountLabel(view.nextAmount) })}</Text>
          <Wrap style={styles.offerActions}>
            <Button
              label={t('practice.increase.action')}
              onPress={() => {
                update((p) => increase(normalize(p, d), d));
                toast(t('habitsTab.plan.increasedToast'));
              }}
            />
          </Wrap>
        </NextStep>
      ) : null}

      {!periodicAct && !archived && view.relapse && !relapseDismissed ? (
        <NextStep title={t('practice.relapse.title')}>
          <Text variant="small">{t('practice.relapse.body', { amount: amountLabel(view.relapseAmount) })}</Text>
          <ButtonPair
            style={styles.offerActions}
            primary={{
              label: t('practice.relapse.action', { amount: amountLabel(view.relapseAmount) }),
              onPress: () => {
                update((p) => decreaseTo(normalize(p, d), view.relapseAmount, d));
                toast(t('practice.plan.settingsSaved'));
              },
              variant: 'outline',
            }}
            secondary={{ label: t('practice.relapse.keep'), onPress: () => setRelapseDismissed(true), variant: 'ghost' }}
          />
        </NextStep>
      ) : null}

      {habit?.evidence?.length ? <SectionDivider /> : null}
      <EvidenceList
        ids={habit?.evidence}
        byId={evidence.data}
        loading={evidence.isLoading}
        error={evidence.isError}
        title={t('practice.evidenceDeedTitle')}
        subtitle={title}
        limit={1}
        moreHref={habit ? `/good-deeds/${habit.deed}` : undefined}
      />

    </>
  );
}

/** The day note and the two optional questions (C-27): saved together, toasted; empty answers clear. */
function ReflectionForm({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const d = today();
  const saved = reflectionOf(store, plan.id, d);
  const [note, setNote] = useState(saved?.note ?? '');
  const [helped, setHelped] = useState(saved?.helped ?? '');
  const [hard, setHard] = useState(saved?.hard ?? '');
  useEffect(() => {
    setNote(saved?.note ?? '');
    setHelped(saved?.helped ?? '');
    setHard(saved?.hard ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, d]);
  const changed = note !== (saved?.note ?? '') || helped !== (saved?.helped ?? '') || hard !== (saved?.hard ?? '');
  return (
    <Section title={t('habitsHub.reflect.title')} lead={t('habitsHub.reflect.lead')}>
      <View style={styles.stack}>
        <Field label={t('habitsHub.reflect.helped')} value={helped} onChangeText={setHelped} maxLength={REFLECTION_TEXT_MAX} placeholder={t('habitsHub.reflect.helpedPlaceholder')} />
        <Field label={t('habitsHub.reflect.hard')} value={hard} onChangeText={setHard} maxLength={REFLECTION_TEXT_MAX} placeholder={t('habitsHub.reflect.hardPlaceholder')} />
        <Field label={t('habitsHub.reflect.note')} value={note} onChangeText={setNote} maxLength={REFLECTION_TEXT_MAX} multiline style={styles.multiline} />
        <Button
          label={t('habitsHub.reflect.save')}
          variant="outline"
          disabled={!changed}
          onPress={() => {
            setStore((s) => setReflection(s, { planId: plan.id, date: d, today: d, note, helped, hard }));
            toast(t('habitsHub.reflect.savedToast'));
          }}
        />
      </View>
    </Section>
  );
}

function LoopTab({ plan, title }: TabProps) {
  const { t } = useTranslation();
  const setStore = usePracticeStore((s) => s.setStore);
  const update = (fn: (p: Plan) => Plan, toastKey: string) => {
    setStore((s) => updatePlan(s, plan.id, fn));
    toast(t(toastKey));
  };
  return (
    <Section title={t('habitsHub.plan.loopTitle')} lead={t('habitsHub.plan.loopLead')}>
      <LoopsPanel
        kind="habit"
        loops={plan.loops ?? []}
        subject={title}
        onAdd={(draft) => update((p) => addHabitLoop(p, newPracticeId(), habitLoopInput(draft)), 'habitsHub.plan.loopSaved')}
        onUpdate={(loopId, draft) => update((p) => updateHabitLoop(p, loopId, habitLoopInput(draft)), 'habitsHub.plan.loopSaved')}
        onRemove={(loopId) => update((p) => removeHabitLoop(p, loopId), 'habitsHub.plan.loopRemoved')}
      />
    </Section>
  );
}

function RemindersTab({ plan, schedule, onEdit }: TabProps & { schedule: string; onEdit: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const habit = habitFor(plan, habits);
  const show = useDisplayTime();
  const d = today();
  const prayerDay = currentPrayerDay(d);
  const offSlots = habit?.window ? unsuitableChoices(slotChoices(plan), habit.window, prayerDay) : [];
  const range = windowRange(habit?.window, prayerDay);
  function fixSlots() {
    if (!habit) return;
    const ordered = orderedSlots(fixedChoices(slotChoices(plan), habit.defaultSlots, habit.window, prayerDay));
    setStore((s) =>
      updatePlan(s, plan.id, (p) => {
        const next: Plan = { ...p, slots: ordered.slots };
        if (ordered.slotAnchors) next.slotAnchors = ordered.slotAnchors;
        else delete next.slotAnchors;
        return next;
      }),
    );
    toast(t('practice.plan.settingsSaved'));
  }
  return (
    <>
      <Section title={t('habitsHub.plan.remindersTitle')}>
        <Text variant="body">{schedule}</Text>
        <Button label={t('habitsHub.plan.editReminders')} icon={PencilLine} variant="outline" onPress={onEdit} />
      </Section>
      {offSlots.length > 0 ? (
        <NextStep title={t('practice.window.unsuitable')}>
          {range ? <Text variant="small">{t('practice.window.line', { from: show(range.from), to: show(range.to) })}</Text> : null}
          <Wrap style={styles.offerActions}>
            <Button label={t('practice.window.fix')} onPress={fixSlots} variant="outline" />
          </Wrap>
        </NextStep>
      ) : null}
      <SectionDivider />
      <ListRow icon={BellRing} title={t('habitsHub.plan.notifications')} hint={t('habitsHub.plan.notificationsHint')} chevron last onPress={() => router.push('/settings/notifications')} />
    </>
  );
}

function ReturnTab({ plan, title, amountLabel }: TabProps & { amountLabel: (n: number) => string }) {
  const shortDate = useShortDate();
  const { t } = useTranslation();
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const setStore = usePracticeStore((s) => s.setStore);
  const locale = useUiLocale();
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const [mending, setMending] = useState(false);
  const d = today();
  const view = planView(plan, d);
  const mend = mendState({
    offer: makeUpOffer(store, plan, d, { ...planDays, heart }),
    missedYesterday: missedDayBefore(store, plan, d, planDays),
    doneToday: plan.log[d] ?? 0,
    paused: isArchived(plan),
  });
  // C-01j: an unanswered day is asked first; «صلّحها» comes once no day of this habit waits for an answer.
  const asking = pendingAsks(store, d, { ...planDays, isPeriodicAct: (p) => habitFor(p, habits)?.kind === 'periodic' }).some((a) => a.planId === plan.id);
  const hard = reflectionsOfPlan(store, plan.id).filter((r) => r.hard).slice(0, 5);
  const ifThen = plan.loops?.find((l) => l.ifThen)?.ifThen;
  return (
    <>
      <Section title={t('habitsHub.return.title')} lead={t('habitsHub.return.lead')}>
        {asking ? (
          <PendingAsks today={d} planId={plan.id} />
        ) : showsMend(mend) ? (
          <NextStep title={t(mend === 'steps' ? 'habitsHub.return.gapYesterday' : 'habitsHub.return.gapTwice')}>
            <Wrap>
              <Button label={t('myHabits.fix')} onPress={() => setMending(true)} variant="outline" />
            </Wrap>
          </NextStep>
        ) : (
          <Notice>{t('habitsHub.return.noGap')}</Notice>
        )}
        <Text variant="body">{t('habitsHub.return.rule', { amount: amountLabel(minimumOf(plan)) })}</Text>
        {view.relapse ? (
          <Button
            label={t('practice.relapse.action', { amount: amountLabel(view.relapseAmount) })}
            variant="outline"
            onPress={() => {
              setStore((s) => updatePlan(s, plan.id, (p) => decreaseTo(normalize(p, d), view.relapseAmount, d)));
              toast(t('practice.plan.settingsSaved'));
            }}
          />
        ) : null}
        {ifThen ? <Text variant="small">{`${t('habitsHub.learn.yourPlan')}: ${ifThen}`}</Text> : null}
      </Section>
      <SectionDivider />
      <Section title={t('habitsHub.learn.title')} lead={t('habitsHub.learn.habitLead')}>
        {hard.length === 0 ? (
          <Text variant="small" tone="muted">
            {t('habitsHub.learn.empty')}
          </Text>
        ) : (
          hard.map((r) => (
            <Text key={r.date} variant="body">
              <Text variant="small" tone="muted">{`${shortDate(r.date)}: `}</Text>
              {r.hard}
            </Text>
          ))
        )}
      </Section>
      <HabitFixSheet visible={mending} onClose={() => setMending(false)} plan={plan} habit={habitFor(plan, habits)} title={title} today={d} />
    </>
  );
}
