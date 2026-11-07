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
import { ChevronDown, ChevronUp, ClipboardCheck, HeartHandshake, Moon, Sun, type LucideIcon } from 'lucide-react-native';
import {
  activePrograms,
  applyStep,
  dayAgenda,
  daySummary,
  heartSlot,
  intentionOf,
  makeIntention,
  saveEvening,
  saveWeeklyReview,
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
import { usePracticeStore } from '@/lib/practice/practice-store';
import { pledgeDeedWords } from '@/lib/practice/pledges';
import { habitFor } from '@/lib/practice/reminders';
import { usePlanDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, ButtonPair, CheckRow, Chip, Field, Icon, Text, toast } from '@/ui';
import { StoryBody } from './KnowledgeCards';

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

export function EveningForm({ today, onDone }: { today: LocalDate; onDone: () => void }) {
  const { t } = useTranslation();
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const planDays = usePlanDays();
  const [kept, setKept] = useState<PledgeKept | null>(null);
  const summary = daySummary(store, today, planDays);
  const intention = intentionOf(heart, today);
  const hasProgram = activePrograms(store.programs).length > 0;
  function save() {
    setHeart((h) => saveEvening(h, { date: today, ...(kept ? { kept } : {}) }));
    toast(t('practice.heart.evening.savedToast'));
    onDone();
  }
  return (
    <>
      <Text variant="small" weight="medium">
        {t('practice.heart.evening.doneQ')}
      </Text>
      <Text variant="small" tone="muted">
        {summary.asked.length === 0
          ? t('practice.heart.evening.doneNone')
          : t('practice.heart.evening.doneSummary', { done: summary.done.length, total: summary.asked.length })}
      </Text>
      {intention?.pledge ? (
        <>
          <Text variant="small" weight="medium">
            {t('practice.heart.evening.keptQ')}
          </Text>
          <Text variant="small" tone="muted">
            {intention.pledge}
          </Text>
          <Choices
            value={kept}
            onChange={setKept}
            options={(['yes', 'partly', 'no'] as const).map((k) => ({ key: k, label: t(`practice.heart.evening.${k}`) }))}
          />
        </>
      ) : null}
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

export function WeeklyForm({ today, weekOf, onDone }: { today: LocalDate; weekOf: LocalDate; onDone: () => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const summary = useMemo(() => weekSummary(store, weekOf, today, planDays), [store, weekOf, today, planDays]);
  const candidates = store.plans.filter((p) => !p.pausedOn || p.resumedOn);
  const [planId, setPlanId] = useState<string | null>(null);
  const [choice, setChoice] = useState<StepChoice>('keep');
  const [feeling, setFeeling] = useState<HeartFeeling | null>(null);
  const [message, setMessage] = useState('');

  const selectedId = planId ?? summary.weak[0]?.planId ?? summary.steady[0]?.planId ?? candidates[0]?.id ?? null;
  const selected = store.plans.find((p) => p.id === selectedId) ?? null;
  const choices = selected ? stepChoices(selected, today) : [];
  const title = (id: string) => {
    const plan = store.plans.find((p) => p.id === id);
    return plan ? planTitleOf(plan, habits, locale) : '';
  };
  const lines = [
    ...summary.weak.map((r) => ({ planId: r.planId, title: title(r.planId), missed: r.missed })),
    ...summary.steady.map((r) => ({ planId: r.planId, title: title(r.planId), missed: 0 })),
  ];

  function save() {
    const step = selected && choices.includes(choice) ? { planId: selected.id, choice } : undefined;
    if (step && step.choice !== 'keep') setStore((s) => updatePlan(s, step.planId, (p) => applyStep(p, step.choice, today)));
    setHeart((h) =>
      saveWeeklyReview(h, {
        weekOf,
        steady: summary.steady.map((r) => ({ planId: r.planId, title: title(r.planId), missed: 0 })),
        weak: summary.weak.map((r) => ({ planId: r.planId, title: title(r.planId), missed: r.missed })),
        ...(step ? { step } : {}),
        ...(feeling ? { heart: feeling } : {}),
        message,
      }),
    );
    toast(t('practice.heart.weekly.savedToast'));
    onDone();
  }

  return (
    <>
      <Text variant="small" tone="muted">
        {t('practice.heart.weekly.lead')}
      </Text>
      {lines.length > 0 ? <HabitLines lines={lines} /> : null}
      {candidates.length > 0 ? (
        <>
          <Text variant="small" weight="medium">
            {t('practice.heart.weekly.step')}
          </Text>
          <Choices
            value={selectedId}
            onChange={(id) => {
              setPlanId(id);
              setChoice('keep');
            }}
            options={candidates.map((p) => ({ key: p.id, label: planTitleOf(p, habits, locale) }))}
          />
          <Choices value={choice} onChange={setChoice} options={choices.map((c) => ({ key: c, label: t(`practice.heart.weekly.${c}`) }))} />
        </>
      ) : null}
      <Text variant="small" weight="medium">
        {t('practice.heart.weekly.heart')}
      </Text>
      <Choices
        value={feeling}
        onChange={setFeeling}
        options={(['present', 'middle', 'hard'] as const).map((k) => ({ key: k, label: t(`practice.heart.weekly.${k}`) }))}
      />
      <Field
        label={t('practice.heart.weekly.message')}
        placeholder={t('practice.heart.weekly.messagePlaceholder', { day: t(`practice.weekdays.${heart.prefs.reviewDay}`) })}
        value={message}
        maxLength={140}
        onChangeText={setMessage}
      />
      <Button size="lg" label={t('practice.heart.weekly.save')} onPress={save} />
    </>
  );
}
