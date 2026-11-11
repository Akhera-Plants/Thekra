/**
 * «المقامات» (owner round 5, F-06 a / F-35 a / A-01 a): ONE heart card at the top of «ورد اليوم», chosen by
 * practice-core `heartSlot` (نية اليوم in the morning → the evening review from its time → the weekly review on its
 * day → «عملك المعتاد يُكتب لك» the morning after an excused or heavy day). The card is one line with «ابدأ» that opens
 * a sheet with the form, so the habits stay at the top of the page. The same forms open from «محاسبتي» (start now).
 * Every rule is practice-core; the data is device-local (practice-store `heart`). Calm words only: no guilt.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronUp, ClipboardCheck, HeartHandshake, Moon, Sun, type LucideIcon } from 'lucide-react-native';
import {
  activePrograms,
  addDays,
  addSelfMessage,
  applyStep,
  cleanSelfMessage,
  dayAgenda,
  daySummary,
  HEART_LINE_MAX,
  heartSlot,
  intentionOf,
  makeIntention,
  saveEvening,
  periodAnswers,
  REVIEW_STEP_ROWS,
  saveWeeklyReview,
  SELF_MESSAGE_MAX_LENGTH,
  SELF_MESSAGES_MAX,
  selfMessageError,
  setHeartPrefs,
  stepChoices,
  updatePlan,
  weekSummary,
  type HeartFeeling,
  type LocalDate,
  type Pledge,
  type PledgeKept,
  type Plan,
  type StepChoice,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick, type CatalogHabit } from '@/lib/practice/catalog-types';
import { nowTime } from '@/lib/practice/format';
import { heartCardView, REVIEW_LINES_SHOWN, type HeartSheet } from '@/lib/practice/habits-view';
import { newPracticeId, usePracticeStore } from '@/lib/practice/practice-store';
import { useReviewDraft } from '@/lib/practice/review-draft';
import { pledgeDeedWords } from '@/lib/practice/pledges';
import { habitFor } from '@/lib/practice/reminders';
import { usePlanDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, ButtonPair, CheckRow, Chip, Field, Icon, Text, toast } from '@/ui';
import { StoryBody } from './KnowledgeCards';
import { NoteField, useFieldChain } from './ReviewFields';

const makeStyles = (t: Theme) => ({
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
    paddingStart: space.lg,
    paddingEnd: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
  },
  cardText: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  stack: { gap: space.md },
  line: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  lineText: { flex: 1, minWidth: 0 },
  badge: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.full, backgroundColor: t.colors.muted },
  more: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs, minHeight: 44, alignSelf: 'flex-start' as const },
});

type T = (key: string, opts?: Record<string, unknown>) => string;

export function planTitleOf(plan: Plan, habits: readonly CatalogHabit[], locale: 'ar' | 'en'): string {
  const habit = habitFor(plan, habits);
  return habit ? pick(habit, 'title', locale) : plan.title;
}

/** A deed in the UI locale: practice-core's deed titles, «أتصدق بـ…», or the user's own line. */
export function pledgeWords(pledge: Pick<Pledge, 'action' | 'text'>, t: T, locale: 'ar' | 'en'): string {
  return pledgeDeedWords(pledge, locale, {
    sadaqah: (text) => t('practice.heart.pledge.sadaqah', { text }),
    sadaqahPlain: t('practice.heart.pledge.sadaqahPlain'),
  });
}

function Choices<K extends string>({ value, options, onChange }: { value: K | null; options: { key: K; label: string }[]; onChange: (k: K) => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o.key} label={o.label} selected={value === o.key} onPress={() => onChange(o.key)} />
      ))}
    </View>
  );
}

const SHEET_ICONS: Record<HeartSheet, LucideIcon> = {
  'intention-offer': Sun,
  intention: Sun,
  evening: Moon,
  weekly: ClipboardCheck,
  'usual-deed': HeartHandshake,
};

const SHEET_TITLES: Record<HeartSheet, string> = {
  'intention-offer': 'practice.heart.intention.offerTitle',
  intention: 'practice.heart.intention.title',
  evening: 'practice.heart.evening.title',
  weekly: 'practice.heart.weekly.title',
  'usual-deed': 'practice.story.heavyDay',
};

/** The one card of «ورد اليوم», or nothing. */
export function HeartSlotCard({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const locale = useUiLocale();
  const habits = usePracticeCatalog(locale).data?.habits;
  const [open, setOpen] = useState(false);
  const time = nowTime();
  const slot = useMemo(
    () => heartSlot(heart, store, today, time, { isPeriodicAct: (plan) => habitFor(plan, habits ?? [])?.kind === 'periodic' }),
    [heart, store, today, time, habits],
  );
  // The slot can move on while the sheet is open (a save closes it): keep the sheet of the card that opened it.
  const [sheet, setSheet] = useState<HeartSheet | null>(null);
  const view = heartCardView(slot);
  if (!view) return null;
  const weekOf = slot?.kind === 'weekly' ? slot.weekOf : null;
  const close = () => setOpen(false);
  return (
    <>
      <View style={styles.card}>
        {view.sheet ? <Icon icon={SHEET_ICONS[view.sheet]} size={20} tone="link" /> : <Icon icon={Sun} size={20} tone="muted" />}
        <Text variant="body" weight={view.actionKey ? 'medium' : 'regular'} tone={view.actionKey ? 'default' : 'muted'} style={styles.cardText}>
          {t(view.lineKey)}
        </Text>
        {view.actionKey && view.sheet ? (
          <Button
            label={t(view.actionKey)}
            size="sm"
            variant="outline"
            onPress={() => {
              setSheet(view.sheet);
              setOpen(true);
            }}
          />
        ) : null}
      </View>
      <HeartSheetView sheet={open ? sheet : null} today={today} weekOf={weekOf} onClose={close} />
    </>
  );
}

/** A heart form in a bottom sheet (`sheet` null: closed). */
export function HeartSheetView({
  sheet,
  today,
  weekOf,
  onClose,
}: {
  sheet: HeartSheet | null;
  today: LocalDate;
  weekOf: LocalDate | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [last, setLast] = useState<HeartSheet>('intention');
  if (sheet && sheet !== last) setLast(sheet);
  const shown = sheet ?? last;
  return (
    <BottomSheet visible={sheet !== null} title={t(SHEET_TITLES[shown])} onClose={onClose}>
      {shown === 'intention-offer' ? <IntentionOffer onDone={onClose} /> : null}
      {shown === 'intention' ? <IntentionForm today={today} onDone={onClose} /> : null}
      {shown === 'evening' ? <EveningForm today={today} onDone={onClose} /> : null}
      {shown === 'weekly' && weekOf ? <WeeklyForm today={today} weekOf={weekOf} onDone={onClose} /> : null}
      {shown === 'usual-deed' ? (
        <StoryBody moment="heavyDay" onLeave={onClose} />
      ) : null}
    </BottomSheet>
  );
}

/** The one-time offer of «نية اليوم»: turn it on, or not now. */
function IntentionOffer({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const setHeart = usePracticeStore((s) => s.setHeart);
  return (
    <>
      <Text variant="body">{t('practice.heart.intention.offerBody')}</Text>
      <ButtonPair
        primary={{
          label: t('practice.heart.intention.offerOn'),
          onPress: () => {
            setHeart((h) => setHeartPrefs(h, { intention: true }));
            toast(t('habitsTab.heart.intentionOnToast'));
            onDone();
          },
        }}
        secondary={{
          label: t('practice.heart.intention.dismiss'),
          onPress: () => {
            setHeart((h) => setHeartPrefs(h, { intentionOfferDismissed: true }));
            onDone();
          },
        }}
      />
    </>
  );
}

export function IntentionForm({ today, onDone }: { today: LocalDate; onDone: () => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const due = useMemo(
    () => dayAgenda(store, today, planDays).flatMap((i) => (i.kind === 'habit' ? store.plans.filter((p) => p.id === i.planId) : [])),
    [store, today, planDays],
  );
  const made = intentionOf(heart, today);
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(
    () => new Set(made ? due.filter((p) => !made.planIds.includes(p.id)).map((p) => p.id) : []),
  );
  const [pledge, setPledge] = useState(made?.pledge ?? '');
  return (
    <>
      <Text variant="small">{t('practice.heart.intention.lead')}</Text>
      {due.length === 0 ? (
        <Text variant="small" tone="muted">
          {t('practice.heart.intention.noHabits')}
        </Text>
      ) : (
        due.map((plan) => (
          <CheckRow
            key={plan.id}
            title={planTitleOf(plan, habits, locale)}
            checked={!unticked.has(plan.id)}
            onPress={() =>
              setUnticked((prev) => {
                const next = new Set(prev);
                if (next.has(plan.id)) next.delete(plan.id);
                else next.add(plan.id);
                return next;
              })
            }
          />
        ))
      )}
      <Field
        label={t('practice.heart.intention.pledgeLabel')}
        placeholder={t('practice.heart.intention.pledgePlaceholder')}
        value={pledge}
        maxLength={140}
        onChangeText={setPledge}
      />
      <Button
        size="lg"
        label={t('practice.heart.intention.submit')}
        onPress={() => {
          setHeart((h) => makeIntention(h, { date: today, planIds: due.filter((p) => !unticked.has(p.id)).map((p) => p.id), pledge }));
          toast(t('practice.heart.intention.savedToast'));
          onDone();
        }}
      />
    </>
  );
}

/**
 * «محاسبة المساء» as a form (round 8): what was completed, the day's pledge, then the member's own words, all optional:
 * «ما أعانك اليوم؟», «ما صعّب عليك اليوم؟» (his answers to the daily question as chips) and «خطوة لغد».
 */
export function EveningForm({ today, onDone }: { today: LocalDate; onDone: () => void }) {
  const { t } = useTranslation();
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const planDays = usePlanDays();
  const { draft, patch, clear } = useReviewDraft(`evening:${today}`, { kept: null as PledgeKept | null, helped: '', hard: '', tomorrow: '' });
  const chain = useFieldChain();
  const answers = useMemo(() => periodAnswers(store, today, today), [store, today]);
  const summary = daySummary(store, today, planDays);
  const intention = intentionOf(heart, today);
  const hasProgram = activePrograms(store.programs).length > 0;
  function save() {
    setHeart((h) =>
      saveEvening(h, { date: today, ...(draft.kept ? { kept: draft.kept } : {}), helped: draft.helped, hard: draft.hard, tomorrow: draft.tomorrow }),
    );
    clear();
    toast(t('practice.heart.evening.savedToast'));
    onDone();
  }
  return (
    <>
      <Text variant="small" tone="muted">
        {summary.asked.length === 0
          ? t('practice.heart.evening.doneNone')
          : t('practice.heart.evening.doneSummary', { done: summary.done.length, total: summary.asked.length })}
      </Text>
      {intention?.pledge ? (
        <>
          <Text variant="body" weight="medium">
            {t('practice.heart.evening.keptQ')}
          </Text>
          <Text variant="small" tone="muted">
            {intention.pledge}
          </Text>
          <Choices
            value={draft.kept}
            onChange={(kept) => patch({ kept })}
            options={(['yes', 'partly', 'no'] as const).map((k) => ({ key: k, label: t(`practice.heart.evening.${k}`) }))}
          />
        </>
      ) : null}
      <NoteField
        chain={chain}
        index={0}
        label={t('practice.heart.evening.helpedQ')}
        value={draft.helped}
        onChange={(helped) => patch({ helped })}
        answers={answers.helped}
        answersLabel={t('practice.heart.evening.fromDaily')}
      />
      <NoteField
        chain={chain}
        index={1}
        label={t('practice.heart.evening.hardQ')}
        value={draft.hard}
        onChange={(hard) => patch({ hard })}
        answers={answers.hard}
        answersLabel={t('practice.heart.evening.fromDaily')}
      />
      <NoteField
        chain={chain}
        index={2}
        last
        label={t('practice.heart.evening.tomorrowQ')}
        placeholder={t('practice.heart.evening.tomorrowPlaceholder')}
        value={draft.tomorrow}
        onChange={(tomorrow) => patch({ tomorrow })}
      />
      {/* «تمّت المحاسبة» and «سجّل حالك في برنامجك الخاص» are one choice: side by side, the same size (O-02). */}
      <ButtonPair
        size="lg"
        primary={{ label: t('practice.heart.evening.save'), onPress: save }}
        secondary={
          hasProgram
            ? {
                label: t('practice.heart.evening.checkIn'),
                onPress: () => {
                  onDone();
                  router.push('/practice/sin-program');
                },
              }
            : null
        }
      />
    </>
  );
}

/** Habit lines with «فاتك n» (A-12 a): the weakest {@link REVIEW_LINES_SHOWN} first, the rest behind «المزيد». */
export function HabitLines({ lines }: { lines: readonly { planId: string; title: string; missed: number }[] }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [all, setAll] = useState(false);
  const shown = all ? lines : lines.slice(0, REVIEW_LINES_SHOWN);
  return (
    <View>
      {shown.map((line) => (
        <View key={line.planId} style={styles.line}>
          <Text variant="small" style={styles.lineText} numberOfLines={2}>
            {line.title}
          </Text>
          <View style={styles.badge}>
            <Text variant="caption" tone={line.missed > 0 ? 'default' : 'link'}>
              {line.missed > 0 ? t('habitsTab.review.missed', { count: line.missed }) : t('habitsTab.review.steady')}
            </Text>
          </View>
        </View>
      ))}
      {lines.length > REVIEW_LINES_SHOWN ? (
        <Pressable onPress={() => setAll((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: all }} style={styles.more}>
          <Text variant="small" weight="medium" tone="link">
            {all ? t('habitsTab.review.less') : t('habitsTab.review.more', { count: lines.length - REVIEW_LINES_SHOWN })}
          </Text>
          <Icon icon={all ? ChevronUp : ChevronDown} size={16} tone="link" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** «زِد خطوة / خفّف / أبقِ» of one habit: a tap chooses, a second tap on the same chip clears it (no step). */
function StepChoices({ value, options, onChange }: { value: StepChoice | undefined; options: StepChoice[]; onChange: (v: StepChoice | undefined) => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.chips}>
      {options.map((c) => (
        <Chip key={c} label={t(`practice.heart.weekly.${c}`)} selected={value === c} onPress={() => onChange(value === c ? undefined : c)} />
      ))}
    </View>
  );
}

/**
 * «محاسبة الأسبوع» as a form (round 8): the week's facts as a compact context (steady habits checked, hard ones with
 * «لم تتم في n أيام»), then the member's own words («ما الذي أعانك؟», «ما الذي صعّب عليك؟», «ماذا ستغيّر؟»; his daily
 * answers of the week are one-tap chips), a step per listed habit (the three weakest, one choice each, each applied),
 * the heart with an optional line, and an optional message to himself (saved to «رسائلي إلى نفسي»). Nothing is required;
 * what is typed survives closing the sheet until it is saved.
 */
export function WeeklyForm({ today, weekOf, onDone }: { today: LocalDate; weekOf: LocalDate; onDone: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const summary = useMemo(() => weekSummary(store, weekOf, today, planDays), [store, weekOf, today, planDays]);
  const answers = useMemo(() => periodAnswers(store, addDays(weekOf, -6), weekOf), [store, weekOf]);
  const { draft, patch, clear } = useReviewDraft(`weekly:${weekOf}`, {
    helped: '',
    hard: '',
    change: '',
    steps: {} as Record<string, StepChoice | undefined>,
    feeling: null as HeartFeeling | null,
    heartNote: '',
    message: '',
  });
  const chain = useFieldChain();
  const byId = (id: string) => store.plans.find((p) => p.id === id);
  const title = (id: string) => {
    const plan = byId(id);
    return plan ? planTitleOf(plan, habits, locale) : '';
  };
  // The hardest habits get a step row; a week with none missed offers the steady ones instead.
  const rows = (summary.weak.length > 0 ? summary.weak : summary.steady).filter((r) => byId(r.planId)).slice(0, REVIEW_STEP_ROWS);
  const messagesFull = (heart.messages?.length ?? 0) >= SELF_MESSAGES_MAX;

  function save() {
    const steps = rows.flatMap((r) => {
      const plan = byId(r.planId);
      const choice = draft.steps[r.planId];
      return plan && choice && stepChoices(plan, today).includes(choice) ? [{ planId: r.planId, choice }] : [];
    });
    const applied = steps.filter((s) => s.choice !== 'keep');
    if (applied.length > 0) setStore((s) => applied.reduce((acc, st) => updatePlan(acc, st.planId, (p) => applyStep(p, st.choice, today)), s));
    setHeart((h) => {
      const next = saveWeeklyReview(h, {
        weekOf,
        steady: summary.steady.map((r) => ({ planId: r.planId, title: title(r.planId), missed: 0 })),
        weak: summary.weak.map((r) => ({ planId: r.planId, title: title(r.planId), missed: r.missed })),
        ...(steps.length > 0 ? { steps } : {}),
        ...(draft.feeling ? { heart: draft.feeling } : {}),
        helped: draft.helped,
        hard: draft.hard,
        change: draft.change,
        heartNote: draft.heartNote,
      });
      // The message goes to the list in «العادات» (the usual limits: 280 characters, ten messages).
      return cleanSelfMessage(draft.message) && !selfMessageError(next, draft.message)
        ? addSelfMessage(next, { id: newPracticeId(), text: draft.message })
        : next;
    });
    clear();
    toast(t('practice.heart.weekly.savedToast'));
    onDone();
  }

  const hasFacts = summary.steady.length > 0 || summary.weak.length > 0;
  return (
    <>
      <Text variant="small" tone="muted">
        {t('practice.heart.weekly.lead')}
      </Text>
      <View accessibilityLabel={t('practice.heart.weekly.weekFacts')}>
        {hasFacts ? null : (
          <Text variant="small" tone="muted">
            {t('practice.heart.weekly.steadyNone')}
          </Text>
        )}
        {summary.steady.map((r) => (
          <View key={r.planId} style={styles.line}>
            <Icon icon={Check} size={16} tone="link" />
            <Text variant="small" style={styles.lineText} numberOfLines={2}>
              {title(r.planId)}
            </Text>
          </View>
        ))}
        {summary.weak.map((r) => (
          <View key={r.planId} style={styles.line}>
            <Text variant="small" style={styles.lineText} numberOfLines={2}>
              {title(r.planId)}
            </Text>
            <Text variant="caption" tone="muted">
              {t('habitsTab.review.missed', { count: r.missed })}
            </Text>
          </View>
        ))}
      </View>
      <NoteField
        chain={chain}
        index={0}
        label={t('practice.heart.weekly.helpedQ')}
        value={draft.helped}
        onChange={(helped) => patch({ helped })}
        answers={answers.helped}
        answersLabel={t('practice.heart.weekly.fromDaily')}
      />
      <NoteField
        chain={chain}
        index={1}
        label={t('practice.heart.weekly.hardQ')}
        value={draft.hard}
        onChange={(hard) => patch({ hard })}
        answers={answers.hard}
        answersLabel={t('practice.heart.weekly.fromDaily')}
      />
      <NoteField chain={chain} index={2} label={t('practice.heart.weekly.changeQ')} value={draft.change} onChange={(change) => patch({ change })} />
      {rows.length > 0 ? (
        <View style={styles.stack}>
          <Text variant="body" weight="medium">
            {t('practice.heart.weekly.step')}
          </Text>
          {rows.map((r) => {
            const plan = byId(r.planId);
            if (!plan) return null;
            return (
              <View key={r.planId} style={styles.stack}>
                <Text variant="small">{title(r.planId)}</Text>
                <StepChoices
                  value={draft.steps[r.planId]}
                  options={stepChoices(plan, today)}
                  onChange={(choice) => patch({ steps: { ...draft.steps, [r.planId]: choice } })}
                />
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={styles.stack}>
        <Text variant="body" weight="medium">
          {t('practice.heart.weekly.heart')}
        </Text>
        <Choices
          value={draft.feeling}
          onChange={(feeling) => patch({ feeling })}
          options={(['present', 'middle', 'hard'] as const).map((k) => ({ key: k, label: t(`practice.heart.weekly.${k}`) }))}
        />
        <Field
          ref={chain.ref(3)}
          accessibilityLabel={t('practice.heart.weekly.heartNoteLabel')}
          placeholder={t('practice.heart.weekly.heartNotePlaceholder')}
          value={draft.heartNote}
          maxLength={HEART_LINE_MAX}
          onChangeText={(heartNote) => patch({ heartNote })}
          returnKeyType="next"
          onSubmitEditing={chain.next(3)}
        />
      </View>
      {messagesFull ? (
        <View style={styles.stack}>
          <Text variant="body" weight="medium">
            {t('practice.heart.weekly.messageLabel')}
          </Text>
          <Text variant="small" tone="muted">
            {t('practice.heart.weekly.messageFull', { max: SELF_MESSAGES_MAX })}
          </Text>
        </View>
      ) : (
        <NoteField
          chain={chain}
          index={4}
          last
          label={t('practice.heart.weekly.messageLabel')}
          placeholder={t('practice.heart.weekly.messagePlaceholder')}
          value={draft.message}
          onChange={(message) => patch({ message })}
          max={SELF_MESSAGE_MAX_LENGTH}
        />
      )}
      <Button size="lg" label={t('practice.heart.weekly.save')} onPress={save} />
    </>
  );
}
