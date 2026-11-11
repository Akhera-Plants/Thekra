/**
 * «عاداتي › الأعمال الدورية» (owner round 6, §6; C-10, C-17, C-24, C-25, C-01i): EVERY periodic act in one list, the
 * catalog's order (practice-core `activePeriodicActs`): «صلة الرحم والأحباب» first — its people lists (relatives,
 * parents, neighbours, friends, the sick) live INSIDE it, opened from its row; never a people page of its own — then
 * the other acts and the member's own acts. Each row follows the reference: the next date large at the reading start,
 * the name, its day and rhythm, «سجّل العمل», the «تعديل» link and a visible trash icon (confirmed). ONE add button:
 * in the header when the list has acts, inside the empty state otherwise (C-25). Reminders only: no commitment here.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, HeartHandshake, PencilLine, Plus, Repeat, Trash2 } from 'lucide-react-native';
import {
  activePeriodicActs,
  deletePlan,
  dueList,
  isCustomPeriodic,
  logForDay,
  correctLog,
  PERIODIC_ACTS,
  periodicActs,
  silatPeople,
  updatePlan,
  weekday,
  type ActivePeriodicAct,
  type LocalDate,
  type Plan,
  type Rule,
  LIMITS,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { weeklyLabel } from '@/lib/practice/habits-view';
import { dueWords } from '@/lib/practice/hub-view';
import { today as todayFn, usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor, planRule } from '@/lib/practice/reminders';
import { useDateNames, useLimits, usePlanDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useAuthStore } from '@/lib/stores/auth-store';
import { radius, space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, ConfirmDialog, EmptyState, IconButton, ListRow, Notice, SectionHeader, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  root: { gap: space.lg },
  row: { gap: space.sm, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  rowLast: { borderBottomWidth: 0 },
  top: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.md },
  date: { width: 56, alignItems: 'center' as const },
  dateNumber: { fontVariant: ['tabular-nums' as const], fontSize: 30, lineHeight: 42 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  actions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, paddingStart: 56 + space.md },
  grow: { flex: 1 },
  link: { minHeight: 44, justifyContent: 'center' as const, paddingHorizontal: space.sm, borderRadius: radius.control },
  linkPressed: { backgroundColor: t.colors.accent },
  stack: { gap: space.md },
});

export function PeriodicTab({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const limits = useLimits(today);
  const planDays = usePlanDays();
  const acts = useMemo(() => activePeriodicActs(store), [store]);
  const next = useMemo(() => periodicActs(store, today, planDays), [store, today, planDays]);
  const [adding, setAdding] = useState(false);
  const nextOf = (id: string) => next.find((a) => a.id === id)?.next ?? null;
  return (
    <View style={styles.root}>
      <SectionHeader
        title={t('habitsHub.periodic.title')}
        lead={t('habitsHub.periodic.lead')}
        action={acts.length > 0 ? <Button label={t('habitsHub.periodic.add')} icon={Plus} size="sm" onPress={() => setAdding(true)} /> : undefined}
      />
      {acts.length === 0 ? (
        <EmptyState icon={Repeat} message={t('habitsHub.periodic.empty')} actionLabel={t('habitsHub.periodic.add')} onAction={() => setAdding(true)} />
      ) : (
        <View>
          {acts.map((act, i) =>
            act.key === 'silat' ? (
              <SilatRow key={act.key} act={act} today={today} last={i === acts.length - 1} />
            ) : (
              act.plans.map((plan, j) => (
                <PlanActRow key={plan.id} act={act} plan={plan} next={nextOf(plan.id)} today={today} last={i === acts.length - 1 && j === act.plans.length - 1} />
              ))
            ),
          )}
        </View>
      )}
      {acts.length > 0 ? (
        <Text variant="caption" tone="muted">
          {t('practice.periodic.count', { n: limits.periodic.count, max: limits.periodic.max })}
        </Text>
      ) : null}
      <AddActSheet visible={adding} acts={acts} canAdd={limits.canAdd('periodic')} onClose={() => setAdding(false)} />
    </View>
  );
}

/** The next date, large: the day number over the month name; «—» when none is coming. */
function DateBlock({ date }: { date: LocalDate | null }) {
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  return (
    <View style={styles.date}>
      <Text variant="title" tone="link" style={styles.dateNumber}>
        {date ? String(Number(date.slice(8))) : '—'}
      </Text>
      {date ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {names.gregorianMonth(Number(date.slice(5, 7)))}
        </Text>
      ) : null}
    </View>
  );
}

/** «صلة الرحم والأحباب»: its people, how many are due, and «افتح» into its lists. No trash: people are removed inside. */
function SilatRow({ act, today, last }: { act: ActivePeriodicAct; today: LocalDate; last: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const due = dueList(act.relatives, today);
  const nowDue = due.overdue.length + due.thisWeek.filter((e) => e.daysUntilDue === 0).length;
  const firstDue = [...due.overdue, ...due.thisWeek, ...due.later].map((e) => e.nextDue).sort()[0] ?? null;
  const lists = silatPeople(act.relatives).map((g) => t(`habitsTab.people.circles.${g.circle}`));
  const open = () => router.push('/practice/kinship');
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Pressable onPress={open} accessibilityRole="button" style={styles.top}>
        <DateBlock date={firstDue && firstDue < today ? today : firstDue} />
        <View style={styles.texts}>
          <Text variant="heading">{t('habitsHub.periodic.silat')}</Text>
          <Text variant="small" tone="muted">
            {t('habitsHub.periodic.silatLine', { count: act.relatives.length, due: nowDue })}
          </Text>
          {lists.length > 0 ? (
            <Text variant="caption" tone="muted">
              {lists.join(' · ')}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Button label={t('habitsHub.periodic.openPeople')} icon={HeartHandshake} variant="outline" size="sm" onPress={open} />
        <View style={styles.grow} />
        <EditLink onPress={open} label={t('habitsHub.periodic.silat')} />
      </View>
    </View>
  );
}

/** One act made of a plan (a catalog act, or the member's own): log it, edit it, delete it (confirmed). */
function PlanActRow({ act, plan, next, today, last }: { act: ActivePeriodicAct; plan: Plan; next: LocalDate | null; today: LocalDate; last: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const names = useDateNames();
  const setStore = usePracticeStore((s) => s.setStore);
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const [confirming, setConfirming] = useState(false);
  const habit = habitFor(plan, habits);
  const title = isCustomPeriodic(plan) ? plan.title : habit ? pick(habit, 'title', locale) : act.info ? act.info[locale] : plan.title;
  const doneToday = (plan.log[today] ?? 0) > 0;
  const rule = planRule(plan, habits);
  const due = dueWords(next, today);
  const line = [next ? names.weekday(weekday(next)) : null, t(due.key, { count: due.count }), rule ? ruleWords(rule, t, locale, names.weekday) : null]
    .filter(Boolean)
    .join(' · ');
  const edit = () => (isCustomPeriodic(plan) ? router.push({ pathname: '/practice/periodic-custom', params: { id: plan.id } }) : router.push(`/practice/plan/${plan.id}`));

  function log() {
    if (doneToday) return;
    setStore((s) => updatePlan(s, plan.id, (p) => logForDay(p, today, 1, todayFn())));
    toast({
      message: t('habitsHub.periodic.loggedToast', { act: title }),
      actionLabel: t('practice.plan.undo'),
      onAction: () => setStore((s) => updatePlan(s, plan.id, (p) => correctLog(p, today, 0))),
    });
  }

  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.top}>
        <DateBlock date={next} />
        <View style={styles.texts}>
          <Text variant="heading">{title}</Text>
          <Text variant="small" tone="muted">
            {line}
          </Text>
        </View>
        <IconButton icon={Trash2} label={t('habitsHub.periodic.delete', { act: title })} onPress={() => setConfirming(true)} />
      </View>
      <View style={styles.actions}>
        <Button
          label={doneToday ? t('habitsHub.periodic.loggedToday') : t('habitsHub.periodic.log')}
          icon={doneToday ? Check : undefined}
          variant="outline"
          size="sm"
          disabled={doneToday}
          onPress={log}
        />
        <View style={styles.grow} />
        <EditLink onPress={edit} label={title} />
      </View>
      {/* The same small confirmation as the website's (owner round 7, R7-A2): ConfirmDialog, not a sheet. */}
      <ConfirmDialog
        visible={confirming}
        title={t('habitsHub.periodic.deleteTitle', { act: title })}
        message={t(signedIn ? 'habitsHub.periodic.deleteBodySynced' : 'habitsHub.periodic.deleteBody')}
        confirmLabel={t('common.delete')}
        tone="destructive"
        icon={Trash2}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setStore((s) => deletePlan(s, plan.id));
          setConfirming(false);
          toast(t('habitsHub.periodic.deletedToast', { act: title }));
        }}
      />
    </View>
  );
}

/** «تعديل» as a link (C-24 a): primary words, a 44px target. Also used by the people rows of «صلة الرحم والأحباب». */
export function EditLink({ onPress, label }: { onPress: () => void; label: string }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${t('habitsHub.periodic.edit')}: ${label}`} style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
      <Text variant="small" weight="medium" tone="link">
        {t('habitsHub.periodic.edit')}
      </Text>
    </Pressable>
  );
}

type T = (key: string, opts?: Record<string, unknown>) => string;

/** A rule in words: «كل جمعة», «كل 3 أيام», «كل شهر يوم 15», «الأيام 13، 14، 15 من كل شهر هجري», «مرة في السنة». */
export function ruleWords(rule: Rule, t: T, locale: 'ar' | 'en', dayName: (d: number) => string): string {
  switch (rule.kind) {
    case 'daily':
      return t('habitsHub.rule.daily');
    case 'weekdays':
      return weeklyLabel(rule.days, locale, dayName);
    case 'everyNDays':
      return t('habitsHub.rule.everyNDays', { count: rule.n });
    case 'everyNWeeks':
      return t('habitsHub.rule.everyNWeeks', { count: rule.n });
    case 'monthlyDay':
      return t('habitsHub.rule.monthlyDay', { day: rule.day });
    case 'hijriMonthDays':
      return t('habitsHub.rule.hijriMonthDays', { days: rule.days.join(locale === 'ar' ? '، ' : ', ') });
    default:
      return t('habitsHub.rule.yearly');
  }
}

/** «أضف عملًا دوريًا»: the catalog's acts not in use yet, then «عمل من عندك». Past the limit of 7: one line. */
function AddActSheet({ visible, acts, canAdd, onClose }: { visible: boolean; acts: readonly ActivePeriodicAct[]; canAdd: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const inUse = new Set(acts.map((a) => a.key));
  const offered = PERIODIC_ACTS.filter((a) => a.key === 'silat' || !inUse.has(a.key));
  const go = (fn: () => void) => {
    onClose();
    fn();
  };
  return (
    <BottomSheet visible={visible} title={t('habitsHub.periodic.addTitle')} onClose={onClose}>
      <View style={styles.stack}>
        {!canAdd ? <Notice>{t('habitsHub.periodic.full', { max: LIMITS.periodic })}</Notice> : null}
        <View>
          {offered.map((info) => (
            <ListRow
              key={info.key}
              icon={info.key === 'silat' ? HeartHandshake : Repeat}
              title={info[locale]}
              hint={info.key === 'silat' ? t('habitsHub.periodic.silatHint') : undefined}
              onPress={() =>
                go(() =>
                  info.key === 'silat'
                    ? router.push('/practice/kinship')
                    : router.push({ pathname: '/practice/add', params: { habit: info.templates[0] } }),
                )
              }
            />
          ))}
          <ListRow icon={PencilLine} title={t('habitsHub.periodic.custom')} hint={t('habitsHub.periodic.customHint')} last onPress={() => go(() => router.push('/practice/periodic-custom'))} />
        </View>
      </View>
    </BottomSheet>
  );
}
