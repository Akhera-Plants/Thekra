/**
 * «المقامات» on «ورد اليوم» (redesign §4.4), mirroring the website's HeartCards: the rotating text (المراقبة), last
 * Friday's «رسالة إلى نفسي» (first, before anything else), «نية اليوم» until noon, a due «التزام شخصي», the Friday review
 * and the evening review. Every rule is practice-core; the data is device-local (practice-store `heart`), never synced.
 * Calm words only: no guilt, no penalty, no comparison.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  activePrograms,
  applyStep,
  dayAgenda,
  daySummary,
  eveningCardVisible,
  intentionOf,
  intentionState,
  keepPledge,
  makeIntention,
  markMessageSeen,
  muraqabaQuoteId,
  pledgesDue,
  saveEvening,
  saveWeeklyReview,
  selfMessageDue,
  setHeartPrefs,
  stepChoices,
  updatePlan,
  weeklyReviewDue,
  weekSummary,
  type HeartFeeling,
  type Pledge,
  type PledgeKept,
  type Plan,
  type StepChoice,
} from '@thekra/practice-core';
import { useEvidence, usePracticeCatalog } from '@/lib/api/practice';
import { pick, type CatalogHabit } from '@/lib/practice/catalog-types';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { usePlanDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, CheckRow, Chip, Field, Text, TextLink } from '@/ui';

const makeStyles = (t: Theme) => ({
  card: { gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  stack: { gap: space.md },
});

type T = (key: string, opts?: Record<string, unknown>) => string;

export function planTitleOf(plan: Plan, habits: readonly CatalogHabit[], locale: 'ar' | 'en'): string {
  const habit = habitFor(plan, habits);
  return habit ? pick(habit, 'title', locale) : plan.title;
}

export function pledgeWords(pledge: Pledge, t: T): string {
  if (pledge.action === 'custom') return pledge.text ?? '';
  if (pledge.action === 'rakatain') return t('practice.heart.pledge.rakatain');
  return pledge.text ? t('practice.heart.pledge.sadaqah', { text: pledge.text }) : t('practice.heart.pledge.sadaqahPlain');
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
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

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** المراقبة: one published text a day, read from the API; hidden without it. */
export function MuraqabaLine({ today }: { today: string }) {
  const locale = useUiLocale();
  const id = muraqabaQuoteId(today);
  const evidence = useEvidence(id ? [id] : [], locale);
  const quote = id ? evidence.data?.get(id) : undefined;
  if (!quote) return null;
  return (
    <Pressable onPress={() => router.push(`/quotes/${quote.id}`)} accessibilityRole="link">
      <Text variant="small" tone="muted" numberOfLines={2}>
        {quote.textAr}
      </Text>
    </Pressable>
  );
}

/** «رسالة إلى نفسي» from last week, on Friday, until read. */
export function SelfMessageCard({ today }: { today: string }) {
  const { t } = useTranslation();
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const review = selfMessageDue(heart, today);
  if (!review?.message) return null;
  return (
    <Card title={t('practice.heart.selfMessage.title')}>
      <Text variant="body">{review.message}</Text>
      <Button label={t('practice.heart.selfMessage.read')} variant="outline" onPress={() => setHeart((h) => markMessageSeen(h, review.weekOf))} />
    </Card>
  );
}

/** The cards under the header, in order; each hides itself when it has nothing to say. */
export function HeartTop({ today }: { today: string }) {
  const styles = useStyles(makeStyles);
  const time = nowTime();
  return (
    <View style={styles.stack}>
      <IntentionCard today={today} time={time} />
      <PledgeCards today={today} />
      <WeeklyCard today={today} time={time} />
      <EveningCard today={today} time={time} />
    </View>
  );
}

function IntentionCard({ today, time }: { today: string; time: string }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const due = useMemo(
    () => dayAgenda(store, today, planDays).flatMap((i) => (i.kind === 'habit' ? store.plans.filter((p) => p.id === i.planId) : [])),
    [store, today, planDays],
  );
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const [pledge, setPledge] = useState('');
  const state = intentionState(heart, today, time);

  if (state === 'offer') {
    return (
      <Card title={t('practice.heart.intention.offerTitle')}>
        <Text variant="small" tone="muted">
          {t('practice.heart.intention.offerBody')}
        </Text>
        <View style={styles.row}>
          <Button label={t('practice.heart.intention.offerOn')} onPress={() => setHeart((h) => setHeartPrefs(h, { intention: true }))} />
          <Button label={t('practice.heart.intention.dismiss')} variant="ghost" onPress={() => setHeart((h) => setHeartPrefs(h, { intentionOfferDismissed: true }))} />
        </View>
      </Card>
    );
  }
  if (state === 'made') {
    const made = intentionOf(heart, today);
    return (
      <Text variant="small" tone="muted">
        {t('practice.heart.intention.made')}
        {made?.pledge ? ` · ${t('practice.heart.intention.pledgeLine', { text: made.pledge })}` : ''}
      </Text>
    );
  }
  if (state !== 'card') return null;
  return (
    <Card title={t('practice.heart.intention.title')}>
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
        label={t('practice.heart.intention.submit')}
        onPress={() => setHeart((h) => makeIntention(h, { date: today, planIds: due.filter((p) => !unticked.has(p.id)).map((p) => p.id), pledge }))}
      />
    </Card>
  );
}

function PledgeCards({ today }: { today: string }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const due = useMemo(() => pledgesDue(store, heart, today, planDays), [store, heart, today, planDays]);
  return (
    <>
      {due.map(({ pledge, on }) => {
        const plan = store.plans.find((p) => p.id === pledge.planId);
        return (
          <Card key={pledge.id} title={t('practice.heart.pledge.title', { text: pledgeWords(pledge, t as unknown as T) })}>
            {plan ? (
              <Text variant="small" tone="muted">
                {t('practice.heart.pledge.hint', { habit: planTitleOf(plan, habits, locale) })}
              </Text>
            ) : null}
            <Button label={t('practice.heart.pledge.kept')} variant="outline" onPress={() => setHeart((h) => keepPledge(h, pledge.id, on))} />
          </Card>
        );
      })}
    </>
  );
}

function EveningCard({ today, time }: { today: string; time: string }) {
  const { t } = useTranslation();
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const planDays = usePlanDays();
  const [kept, setKept] = useState<PledgeKept | null>(null);
  if (!eveningCardVisible(heart, today, time)) return null;
  const summary = daySummary(store, today, planDays);
  const intention = intentionOf(heart, today);
  return (
    <Card title={t('practice.heart.evening.title')}>
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
      {activePrograms(store.programs).length > 0 ? (
        <TextLink label={t('practice.heart.evening.checkIn')} onPress={() => router.push('/practice/sin-program')} />
      ) : null}
      <Button label={t('practice.heart.evening.save')} onPress={() => setHeart((h) => saveEvening(h, { date: today, ...(kept ? { kept } : {}) }))} />
    </Card>
  );
}

function WeeklyCard({ today, time }: { today: string; time: string }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const weekOf = weeklyReviewDue(heart, today, time);
  const summary = useMemo(() => (weekOf ? weekSummary(store, weekOf, today, planDays) : null), [store, weekOf, today, planDays]);
  const candidates = store.plans.filter((p) => !p.pausedOn || p.resumedOn);
  const [planId, setPlanId] = useState<string | null>(null);
  const [choice, setChoice] = useState<StepChoice>('keep');
  const [feeling, setFeeling] = useState<HeartFeeling | null>(null);
  const [message, setMessage] = useState('');
  if (!weekOf || !summary) return null;

  const selectedId = planId ?? summary.weak[0]?.planId ?? summary.steady[0]?.planId ?? candidates[0]?.id ?? null;
  const selected = store.plans.find((p) => p.id === selectedId) ?? null;
  const choices = selected ? stepChoices(selected, today) : [];
  const title = (id: string) => {
    const plan = store.plans.find((p) => p.id === id);
    return plan ? planTitleOf(plan, habits, locale) : '';
  };

  function save() {
    if (!weekOf || !summary) return;
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
  }

  return (
    <Card title={t('practice.heart.weekly.title')}>
      <Text variant="small" tone="muted">
        {t('practice.heart.weekly.lead')}
      </Text>
      <Text variant="small" weight="medium">
        {t('practice.heart.weekly.steady')}
      </Text>
      <Text variant="small" tone={summary.steady.length ? 'default' : 'muted'}>
        {summary.steady.length ? summary.steady.map((r) => title(r.planId)).join(locale === 'ar' ? '، ' : ', ') : t('practice.heart.weekly.steadyNone')}
      </Text>
      <Text variant="small" weight="medium">
        {t('practice.heart.weekly.weak')}
      </Text>
      <Text variant="small" tone={summary.weak.length ? 'default' : 'muted'}>
        {summary.weak.length
          ? summary.weak.map((r) => `${title(r.planId)} (${t('practice.heart.weekly.missed', { count: r.missed })})`).join(locale === 'ar' ? '، ' : ', ')
          : t('practice.heart.weekly.weakNone')}
      </Text>
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
        placeholder={t('practice.heart.weekly.messagePlaceholder')}
        value={message}
        maxLength={140}
        onChangeText={setMessage}
      />
      <Button label={t('practice.heart.weekly.save')} onPress={save} />
    </Card>
  );
}
