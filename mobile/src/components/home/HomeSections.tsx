/**
 * The sections of the home page (owner round 5, F-02 a; practice-core `home.ts` keys), each a self-contained block that
 * hides itself when it has nothing to show:
 * - «ورد اليوم» (members): the day's progress, a circle for each habit not yet logged (it logs right here, with
 *   «تراجع» in the toast; O-03), and «افتح ورد اليوم»;
 * - «شعبة الأسبوع» (F-18): one compact row;
 * - «مناسبة قريبة» (F-17): the next non-weekly occasion within ~10 days (hidden when none);
 * - «أبواب الخير» (round 6, C-06: the reference's drawings and the website's action colours, `HomeDoors`);
 * - «في لحظات مثل هذه» (round 6, C-09: our list from `GET /v1/home-moments`, the same for every user; hidden when
 *   empty), «تذكرة مختارة» and «المصادر»;
 * and «خصّص الرئيسية»: the edit sheet (a switch and «أعلى» / «أسفل» per section), saved with practice-core
 * `setHomeSections` so it syncs. Round 6 (C-04): it opens from the settings («اللغة والمظهر»), never from the home page.
 * «نص اليوم» is gone (C-01q).
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Pause,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import {
  activePrograms,
  correctLog,
  dayCompletion,
  HOME_SECTIONS,
  homeSectionsToStore,
  logForDay,
  setHomeSections,
  updatePlan,
  type HabitItem,
  type HomeSectionKey,
  type HomeSectionPref,
  type LocalDate,
} from '@thekra/practice-core';
import { useHomeMoments, type HomeMomentDto } from '@/lib/api/home-moments';
import { usePracticeCatalog } from '@/lib/api/practice';
import { useReminderOfTheDay } from '@/lib/api/quotes';
import { homeEditRows, moveSectionBy, toggleSection } from '@/lib/home/home-edit';
import { pick } from '@/lib/practice/catalog-types';
import { dayMonth } from '@/lib/practice/calendar-grid';
import { nextOccasion } from '@/lib/practice/habits-view';
import { setMomentSource, today as todayFn, usePracticeStore } from '@/lib/practice/practice-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { habitFor } from '@/lib/practice/reminders';
import { useAgendaRows, useDateNames, useDayAgenda, usePlanDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { FeaturedReminder } from '@/components/home/FeaturedReminder';
import { HomeDoors } from '@/components/home/HomeDoors';
import { HabitRow } from '@/components/practice/hub/AgendaRows';
import { WeekBranchCard } from '@/components/practice/hub/KnowledgeCards';
import { radius, space, useStyles, type Theme } from '@/theme';
import {
  BottomSheet,
  Button,
  ButtonPair,
  ForwardArrow,
  Icon,
  IconButton,
  ListRow,
  Section,
  SectionHeader,
  Text,
  Toggle,
  toast,
} from '@/ui';

const makeStyles = (t: Theme) => ({
  section: { gap: space.md },
  progress: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: t.colors.muted,
    overflow: 'hidden' as const,
    flexDirection: 'row' as const,
  },
  progressFill: { height: 8, borderRadius: radius.full, backgroundColor: t.colors.primary },
  occasion: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
  },
  pressed: { opacity: 0.75 },
  occasionText: { flex: 1, minWidth: 0, gap: 2 },
  editRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.xs,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  editTitle: { flex: 1, minWidth: 0 },
});

/** The API's icon keys (home-moments.yaml) on lucide glyphs; an unknown key gets a neutral one. */
const MOMENT_ICONS: Record<string, LucideIcon> = { pause: Pause, sun: Sun, 'message-circle': MessageCircle, heart: Heart };

/** The title of a section, shared with the web (practice-core `HOME_SECTIONS`). */
export function useSectionTitle(key: HomeSectionKey): string {
  const locale = useUiLocale();
  const info = HOME_SECTIONS.find((s) => s.key === key);
  return info ? info[locale] : key;
}

/**
 * One home section by key. `before` (the flower divider) is drawn only when the section has something to show, so a
 * section that hides itself never leaves two dividers in a row.
 */
export function HomeSection({ name, today, before }: { name: HomeSectionKey; today: LocalDate; before?: React.ReactNode }) {
  switch (name) {
    case 'wird':
      return <WirdSection today={today} before={before} />;
    case 'week-branch':
      return <WeekBranchCard today={today} before={before} />;
    case 'occasion':
      return <OccasionSection today={today} before={before} />;
    case 'doors':
      return <DoorsSection before={before} />;
    case 'moments':
      return <MomentsSection before={before} />;
    case 'featured':
      return <FeaturedSection before={before} />;
    case 'sources':
      // «تذكير تعرف مصدره» is for the website only (owner round 7, B9); the key stays in the synced order.
      return null;
  }
}

type Before = { before?: React.ReactNode };

/**
 * Whether a section has something to show now, so the page draws a divider only between visible sections. Sections
 * that fetch (texts, the reminder) count as showing while they load.
 */
export function useSectionShows(today: LocalDate): (key: HomeSectionKey) => boolean {
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const plans = usePracticeStore((s) => s.store.plans);
  const occasion = useMemo(
    () => nextOccasion(catalog.data?.occasions ?? [], today, hijriOffset),
    [catalog.data?.occasions, today, hijriOffset],
  );
  return (key) => {
    if (key === 'occasion') return occasion !== null;
    if (key === 'wird') return plans.length > 0;
    return true;
  };
}

// ── «ورد اليوم» ─────────────────────────────────────────────────────────────────────────────────────────────

function WirdSection({ today, before }: { today: LocalDate } & Before) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits;
  const planDays = usePlanDays();
  const items = useDayAgenda(today);
  const rows = useAgendaRows(items, today, today);
  const { asked } = useMemo(() => dayCompletion(store, today, planDays), [store, today, planDays]);
  const done = asked.filter((p) => (p.log[today] ?? 0) > 0).length;
  // The habits not logged yet (periodic acts stay in «عاداتي»): each one logs right here.
  const open = rows.filter(
    (r): r is Extract<typeof r, { kind: 'habit' }> =>
      r.kind === 'habit' &&
      !r.item.complete &&
      habitFor(store.plans.find((p) => p.id === r.item.planId)!, habits ?? [])?.kind !== 'periodic',
  );
  const title = useSectionTitle('wird');

  function log(item: HabitItem) {
    const before = item.done;
    const amount = item.missedYesterday && item.done === 0 && item.minimum ? item.minimum : item.remaining;
    setStore((s) => updatePlan(s, item.planId, (p) => logForDay(p, today, amount, todayFn())));
    toast({
      message: t('practice.plan.logged'),
      actionLabel: t('practice.plan.undo'),
      onAction: () => setStore((s) => updatePlan(s, item.planId, (p) => correctLog(p, today, before))),
    });
  }

  if (store.plans.length === 0) return null;
  const share = asked.length > 0 ? done / asked.length : 0;
  return (
    <>
      {before}
      <View style={styles.section}>
        <SectionHeader
          title={title}
          lead={asked.length > 0 ? t('homeSections.wird.progress', { done, total: asked.length }) : t('homeSections.wird.restDay')}
          action={
            <Button label={t('homeSections.wird.open')} variant="outline" size="sm" arrow onPress={() => router.navigate('/habits')} />
          }
        />
        {asked.length > 0 ? (
          <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: asked.length, now: done }}>
            <View style={[styles.progressFill, { flex: share }]} />
            <View style={{ flex: 1 - share }} />
          </View>
        ) : null}
        {open.length > 0 ? (
          <View>
            {open.map((row) => (
              <HabitRow
                key={row.key}
                item={row.item}
                title={row.title}
                meta={row.meta}
                canLog
                undo={null}
                onToggle={log}
                onUndo={() => undefined}
              />
            ))}
          </View>
        ) : asked.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon icon={Check} size={18} tone="link" />
            <Text variant="body" tone="link">
              {t('practice.celebrate.dayDone')}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

// ── «مناسبة قريبة» ─────────────────────────────────────────────────────────────────────────────────────────

function OccasionSection({ today, before }: { today: LocalDate } & Before) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  const catalog = usePracticeCatalog(locale);
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const next = useMemo(
    () => nextOccasion(catalog.data?.occasions ?? [], today, hijriOffset),
    [catalog.data?.occasions, today, hijriOffset],
  );
  const title = useSectionTitle('occasion');
  if (!next) return null;
  const when =
    next.inDays === 0
      ? t('practice.today')
      : next.inDays === 1
        ? t('practice.periodic.tomorrow')
        : t('homeSections.occasion.inDays', { count: next.inDays, date: dayMonth(next.date, names) });
  const name = pick(next.occasion, 'title', locale);
  return (
    <>
      {before}
      <View style={styles.section}>
        <SectionHeader title={title} />
        <Pressable
          onPress={() => router.push(`/good-deeds/${next.occasion.deed}`)}
          accessibilityRole="link"
          accessibilityLabel={`${name}. ${when}`}
          style={({ pressed }) => [styles.occasion, pressed && styles.pressed]}
        >
          <Icon icon={CalendarDays} size={22} tone="link" />
          <View style={styles.occasionText}>
            <Text variant="body" weight="medium">
              {name}
            </Text>
            <Text variant="small" tone="muted">
              {when}
            </Text>
          </View>
          <ForwardArrow size={17} tone="muted" />
        </Pressable>
      </View>
    </>
  );
}

// ── The public sections ────────────────────────────────────────────────────────────────────────────────────

function DoorsSection({ before }: Before) {
  const styles = useStyles(makeStyles);
  const title = useSectionTitle('doors');
  return (
    <>
      {before}
      <View style={styles.section}>
        <SectionHeader title={title} />
        <HomeDoors />
      </View>
    </>
  );
}

function MomentsSection({ before }: Before) {
  const title = useSectionTitle('moments');
  const moments = useHomeMoments();
  const programs = usePracticeStore((st) => st.store.programs);
  const signedIn = useAuthStore((st) => st.user !== null);
  // A row about a sin the member already works on opens «لحظة مجاهدة» for that program; every other row opens its page
  // (owner round 8, item 8: each row lands where its label promises).
  function openMoment(moment: HomeMomentDto) {
    const hasProgram = signedIn && moment.topic.type === 'sin' && activePrograms(programs).some((p) => p.sinSlug === moment.topic.slug);
    if (hasProgram) {
      setMomentSource(moment.topic.slug);
      router.push('/practice/moment');
      return;
    }
    router.push(moment.topic.path as Href);
  }
  const list = moments.data ?? [];
  // Ours, from the API; nothing to show (none published, loading, offline without a cache): no section, no divider.
  if (list.length === 0) return null;
  return (
    <>
      {before}
      <Section title={title}>
        <View>
          {list.map((moment, i) => (
            <ListRow
              key={moment.key}
              icon={MOMENT_ICONS[moment.icon] ?? Sparkles}
              title={moment.label}
              hint={moment.situation ?? undefined}
              onPress={() => openMoment(moment)}
              last={i === list.length - 1}
            />
          ))}
        </View>
      </Section>
    </>
  );
}

function FeaturedSection({ before }: Before) {
  const reminder = useReminderOfTheDay();
  // No text today (null), not loading and no error: nothing, not even the divider.
  if (!reminder.data && !reminder.isLoading && !reminder.isError) return null;
  return (
    <>
      {before}
      <FeaturedReminder
        quote={reminder.data}
        isLoading={reminder.isLoading}
        isError={reminder.isError}
        onRetry={() => void reminder.refetch()}
      />
    </>
  );
}

// ── «خصّص الرئيسية» ─────────────────────────────────────────────────────────────────────────────────────────

export function HomeEditSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const stored = usePracticeStore((s) => s.store.settings.homeSections);
  const setStore = usePracticeStore((s) => s.setStore);
  const [draft, setDraft] = useState<HomeSectionPref[] | null>(null);
  const current = draft ?? stored ?? null;
  const rows = homeEditRows(current, locale);

  // Every opening starts from what is stored.
  const [wasOpen, setWasOpen] = useState(false);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) setDraft(null);
  }

  function save() {
    setStore((s) => setHomeSections(s, homeSectionsToStore(current) ?? null));
    toast(t('homeSections.edit.saved'));
    onClose();
  }

  return (
    <BottomSheet
      visible={visible}
      title={t('homeSections.edit.title')}
      onClose={onClose}
      footer={
        <ButtonPair
          size="lg"
          primary={{ label: t('practice.plan.save'), onPress: save }}
          secondary={{ label: t('homeSections.edit.reset'), onPress: () => setDraft([]) }}
        />
      }
    >
      <Text variant="small" tone="muted">
        {t('homeSections.edit.lead')}
      </Text>
      <View>
        {rows.map((row) => (
          <View key={row.key} style={styles.editRow}>
            <Toggle value={row.visible} label={row.title} onValueChange={() => setDraft(toggleSection(current, row.key))} />
            <Text variant="body" tone={row.visible ? 'default' : 'muted'} style={styles.editTitle}>
              {row.title}
            </Text>
            <IconButton
              icon={ChevronUp}
              label={t('homeSections.edit.up', { section: row.title })}
              disabled={!row.canUp}
              onPress={() => setDraft(moveSectionBy(current, row.key, -1))}
            />
            <IconButton
              icon={ChevronDown}
              label={t('homeSections.edit.down', { section: row.title })}
              disabled={!row.canDown}
              onPress={() => setDraft(moveSectionBy(current, row.key, 1))}
            />
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}
