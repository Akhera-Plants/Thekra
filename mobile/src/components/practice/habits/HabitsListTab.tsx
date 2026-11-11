/**
 * «عاداتي › العادات» (owner round 6, §2; C-02b, C-01d, C-02c, C-02e), top to bottom:
 * - «رسائلي إلى نفسي» as a clear entry at the top (the list screen: add / edit / delete, at most 10);
 * - «عاداتك» with the ONE «أضف عادة» and the line «3 عادات كحد أقصى»; each habit with its completion (practice-core
 *   `habitCompletion`) as a thin bar and a percent, and its milestone lines «تعدّيت أصعب فترة» / «صنعت العادة» /
 *   «شارك تطورك مع الصحبة» (the last for circle members only); «⋯» holds «أرشِف» (with the 3-day note) and «احذف»
 *   (confirmed); the «رسخت؟» offer when practice-core offers it;
 * - the «تخفّف» programs as habits of type «تخفّف» (practice-core `habitListRows`): a neutral covered row by default
 *   — never a sin's name, never blurred — and a tap asks the device lock first (`useProgramReveal`);
 * - «الأرشيف (n من 10)»: each archived habit with what a restore does now («أعِدها»), deletion in its «⋯»;
 * - «استراتيجيات صناعة العادات والثبات»: the entry to the strategies screen (instead of «ما يساند خطتك»).
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Archive, ChevronDown, ChevronUp, Lightbulb, LockKeyhole, Mail, Plus, RotateCcw, Sprout, Trash2, TreeDeciduous, Waves } from 'lucide-react-native';
import {
  ARCHIVE_MAX,
  archiveNote,
  archivedPlans,
  deletePlan,
  establishPlan,
  graduationReady,
  habitCompletion,
  habitListRows,
  habitMilestones,
  isEstablished,
  LIMITS,
  restorePlanInStore,
  selfMessages,
  SELF_MESSAGES_MAX,
  shareSuggestion,
  updatePlan,
  type LocalDate,
  type Plan,
  type SinProgram,
} from '@thekra/practice-core';
import { useMyCircles } from '@/lib/api/circles';
import { usePracticeCatalog } from '@/lib/api/practice';
import { useSins } from '@/lib/api/sins';
import { archiveLine, milestoneLines, restoreToastKey } from '@/lib/practice/hub-view';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useLimits, useShortDate } from '@/lib/practice/use-habits-hub';
import { useProgramReveal } from '@/lib/practice/use-program-reveal';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useAuthStore } from '@/lib/stores/auth-store';
import { planTitleOf } from '@/components/practice/hub/HeartCards';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { LimitSheet } from '@/components/practice/LimitSheet';
import { ActionMenu, Button, EmptyState, ForwardArrow, Icon, ListRow, Notice, SectionDivider, SectionHeader, Text, toast } from '@/ui';
import { ArchiveSheet, HabitAddChoiceSheet } from './HabitActions';

const makeStyles = (t: Theme) => ({
  root: { gap: space['2xl'] },
  section: { gap: space.xs },
  messages: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
  },
  pressed: { backgroundColor: t.colors.accent },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  rowLast: { borderBottomWidth: 0 },
  body: { flex: 1, minWidth: 0, gap: 4, flexDirection: 'row' as const, alignItems: 'center' as const },
  texts: { flex: 1, minWidth: 0, gap: 4 },
  bar: { height: 4, borderRadius: radius.full, backgroundColor: t.colors.muted, overflow: 'hidden' as const },
  fill: { height: 4, borderRadius: radius.full, backgroundColor: t.colors.primary },
  covered: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: t.colors.muted, alignItems: 'center' as const, justifyContent: 'center' as const },
  toggle: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: 48 },
  graduation: { gap: space.sm },
});

export function HabitsListTab({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const heart = usePracticeStore((s) => s.heart);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const limits = useLimits(today);
  const reveal = useProgramReveal();
  const inCircle = (useMyCircles().data?.length ?? 0) > 0;
  const [archiving, setArchiving] = useState<Plan | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const isPeriodicAct = (p: Plan) => habitFor(p, habits)?.kind === 'periodic';
  const rows = useMemo(
    () =>
      habitListRows(store, store.programs.length > 0 ? store.programs : null, {
        isPeriodicAct,
        hasPrograms: reveal.hasPrograms,
        // Round 7 (C6): no privacy code → nothing to unlock, so the programs show like any habit.
        ...(reveal.noCode ? { covered: false } : {}),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, habits, reveal.hasPrograms, reveal.noCode],
  );
  const habitRows = rows.filter((r) => r.kind === 'habit');
  const lightenRows = rows.filter((r) => r.kind === 'lighten');
  const archived = archivedPlans(store);
  const messages = selfMessages(heart);
  const ready = habitRows.map((r) => r.plan).filter((p) => graduationReady(p, today));
  const title = (p: Plan) => planTitleOf(p, habits, locale);

  function add() {
    if (!limits.canAdd('sapling')) setLimitOpen(true);
    else router.push('/practice/add');
  }

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => router.push('/practice/self-messages')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.messages, pressed && styles.pressed]}
      >
        <Icon icon={Mail} size={22} tone="link" />
        <View style={styles.grow}>
          <Text variant="body" weight="medium">
            {t('habitsHub.messages.title')}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {messages[0]?.text ?? t('habitsHub.messages.entryHint')}
          </Text>
        </View>
        <Text variant="small" tone="muted">{`${messages.length}/${SELF_MESSAGES_MAX}`}</Text>
        <ForwardArrow size={16} tone="muted" />
      </Pressable>

      <View style={styles.section}>
        <SectionHeader
          title={t('habitsHub.habits.title')}
          lead={t('habitsHub.habits.maxLine', { max: LIMITS.sapling, count: limits.sapling.count })}
          action={habitRows.length > 0 ? <Button label={t('habitsHub.habits.add')} icon={Plus} size="sm" onPress={add} /> : undefined}
        />
        {ready.map((plan) => (
          <View key={`g-${plan.id}`} style={styles.graduation}>
            <Notice tone="muted">{`${title(plan)} · ${t('practice.graduation.offer')}`}</Notice>
            <Button
              label={t('practice.graduation.action')}
              variant="outline"
              onPress={() => {
                setStore((s) => updatePlan(s, plan.id, (p) => establishPlan(p, today)));
                toast(t('habitsTab.record.establishedToast'));
              }}
            />
          </View>
        ))}
        {habitRows.length === 0 ? (
          <EmptyState icon={Sprout} message={t('habitsHub.habits.empty')} actionLabel={t('habitsHub.habits.add')} onAction={add} />
        ) : (
          <View>
            {habitRows.map((r, i) =>
              r.kind === 'habit' ? (
                <HabitRow
                  key={r.plan.id}
                  plan={r.plan}
                  title={title(r.plan)}
                  today={today}
                  inCircle={inCircle}
                  last={i === habitRows.length - 1 && lightenRows.length === 0}
                  onArchive={() => setArchiving(r.plan)}
                />
              ) : null,
            )}
          </View>
        )}
        {lightenRows.length > 0 ? (
          <View>
            {lightenRows.map((r, i) =>
              r.kind === 'lighten' ? (
                <LightenRow key={r.program?.sinSlug ?? `locked-${i}`} covered={r.covered} program={r.program} last={i === lightenRows.length - 1} onOpen={() => void reveal.openProgram()} />
              ) : null,
            )}
          </View>
        ) : null}
      </View>

      {archived.length > 0 ? (
        <>
          <SectionDivider />
          <ArchiveSection plans={archived} today={today} title={title} />
        </>
      ) : null}

      <SectionDivider />
      <View style={styles.section}>
        <SectionHeader title={t('habitsHub.strategies.title')} lead={t('habitsHub.strategies.lead')} />
        <ListRow icon={Lightbulb} title={t('habitsHub.strategies.open')} hint={t('habitsHub.strategies.hint')} last onPress={() => router.push('/practice/strategies')} />
      </View>

      <ArchiveSheet plan={archiving ?? undefined} title={archiving ? title(archiving) : ''} today={today} visible={archiving !== null} onClose={() => setArchiving(null)} />
      <HabitAddChoiceSheet
        visible={limitOpen}
        today={today}
        onClose={() => setLimitOpen(false)}
        onFreed={() => {
          setLimitOpen(false);
          router.push('/practice/add');
        }}
      />
    </View>
  );
}

function HabitRow({ plan, title, today, inCircle, last, onArchive }: { plan: Plan; title: string; today: LocalDate; inCircle: boolean; last: boolean; onArchive: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const setStore = usePracticeStore((s) => s.setStore);
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const completion = habitCompletion(plan, today);
  const lines = milestoneLines(habitMilestones(plan, today), shareSuggestion(plan, today), inCircle);
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Pressable onPress={() => router.push(`/practice/plan/${plan.id}`)} accessibilityRole="button" accessibilityLabel={`${title}. ${t('habitsHub.habits.completion', { percent: completion.percent })}`} style={styles.body}>
        <Icon icon={isEstablished(plan) ? TreeDeciduous : Sprout} size={24} tone="link" strokeWidth={1.3} />
        <View style={styles.texts}>
          <Text variant="body" weight="medium" numberOfLines={2}>
            {title}
          </Text>
          <Text variant="caption" tone="muted">
            {t('habitsHub.habits.completionLine', { percent: completion.percent, done: completion.doneDays, target: completion.targetDays })}
          </Text>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${completion.percent}%` }]} />
          </View>
          {lines.map((key) =>
            key === 'habitsHub.habits.share' ? (
              <Pressable key={key} onPress={() => router.push('/circles')} accessibilityRole="link" hitSlop={8}>
                <Text variant="small" weight="medium" tone="link">
                  {t(key)}
                </Text>
              </Pressable>
            ) : (
              <Text key={key} variant="small" tone="link">
                {t(key)}
              </Text>
            ),
          )}
        </View>
      </Pressable>
      <ActionMenu
        label={t('habitsHub.habits.actions', { habit: title })}
        items={[
          { label: t('habitsHub.archive.action'), icon: Archive, hint: t('habitsHub.archive.menuHint'), onPress: onArchive },
          {
            label: t('practice.plan.delete'),
            icon: Trash2,
            destructive: true,
            onPress: () => {
              setStore((s) => deletePlan(s, plan.id));
              toast(t('practice.plan.deleted'));
            },
            confirm: { title: t('habitsHub.habits.deleteTitle', { habit: title }), message: t(signedIn ? 'practice.plan.deleteConfirmSynced' : 'practice.plan.deleteConfirm'), confirmLabel: t('common.delete') },
          },
        ]}
      />
    </View>
  );
}

/** A «تخفّف» program as a habit: covered (no name, a lock) by default; uncovered it shows the sin's name. */
function LightenRow({ covered, program, last, onOpen }: { covered: boolean; program: SinProgram | null; last: boolean; onOpen: () => void }) {
  const shortDate = useShortDate();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const sins = useSins({ limit: 100 });
  const { colors } = useTheme();
  const name = (() => {
    if (covered || !program) return t('habitsHub.lighten.covered');
    const s = sins.data?.find((x) => x.slug === program.sinSlug);
    if (!s) return t('sinProgram.unnamed');
    return locale === 'en' ? s.name || s.nameAr : s.nameAr || s.name;
  })();
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${t('habitsHub.lighten.type')}: ${name}`} style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && { backgroundColor: colors.accent }]}>
      <View style={styles.covered}>
        <Icon icon={covered || !program ? LockKeyhole : Waves} size={18} tone="muted" />
      </View>
      <View style={styles.texts}>
        <Text variant="body" weight="medium">
          {name}
        </Text>
        <Text variant="caption" tone="muted">
          {program && !covered ? t('sinProgram.since', { date: shortDate(program.startedOn) }) : t('habitsHub.lighten.tapHint')}
        </Text>
      </View>
      <ForwardArrow size={16} tone="muted" />
    </Pressable>
  );
}

/** «الأرشيف»: collapsed by default; each habit with what restoring does now and «أعِدها». */
function ArchiveSection({ plans, today, title }: { plans: Plan[]; today: LocalDate; title: (p: Plan) => string }) {
  const shortDate = useShortDate();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const setStore = usePracticeStore((s) => s.setStore);
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const limits = useLimits(today);
  const [open, setOpen] = useState(false);
  // The habit waiting for a free place: the limit sheet opens at the tap (archive one to bring this back), then it returns.
  const [waiting, setWaiting] = useState<Plan | null>(null);
  function restore(plan: Plan) {
    let reset = false;
    setStore((s) => {
      const r = restorePlanInStore(s, plan.id, today);
      reset = r.reset;
      return r.store;
    });
    toast(t(restoreToastKey(reset), { habit: title(plan) }));
  }
  return (
    <View style={styles.section}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.toggle}>
        <Icon icon={Archive} size={20} tone="link" />
        <View style={styles.grow}>
          <Text variant="heading">{t('habitsHub.archive.title', { count: plans.length, max: ARCHIVE_MAX })}</Text>
          <Text variant="caption" tone="muted">
            {t('habitsHub.archive.lead')}
          </Text>
        </View>
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} tone="muted" />
      </Pressable>
      {open ? (
        <View>
          {plans.map((plan, i) => {
            const line = archiveLine(archiveNote(plan, today));
            return (
              <View key={plan.id} style={[styles.row, i === plans.length - 1 && styles.rowLast]}>
                <View style={styles.texts}>
                  <Text variant="body" weight="medium">
                    {title(plan)}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {`${t('habitsHub.archive.since', { date: shortDate(plan.pausedOn ?? today) })} · ${t(line.key, { ...line.params, date: line.params.date ? shortDate(String(line.params.date)) : undefined })}`}
                  </Text>
                </View>
                <Button
                  label={t('habitsHub.archive.restore')}
                  icon={RotateCcw}
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    if (!limits.canAdd('sapling')) {
                      setWaiting(plan);
                      return;
                    }
                    restore(plan);
                  }}
                />
                <ActionMenu
                  label={t('habitsHub.habits.actions', { habit: title(plan) })}
                  items={[
                    {
                      label: t('practice.plan.delete'),
                      icon: Trash2,
                      destructive: true,
                      onPress: () => {
                        setStore((s) => deletePlan(s, plan.id));
                        toast(t('practice.plan.deleted'));
                      },
                      confirm: { title: t('habitsHub.habits.deleteTitle', { habit: title(plan) }), message: t(signedIn ? 'practice.plan.deleteConfirmSynced' : 'practice.plan.deleteConfirm'), confirmLabel: t('common.delete') },
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      ) : null}
      <LimitSheet
        kind="sapling"
        visible={waiting !== null}
        limits={limits}
        onClose={() => setWaiting(null)}
        onFreed={() => {
          const plan = waiting;
          setWaiting(null);
          if (plan) restore(plan);
        }}
      />
    </View>
  );
}
