/**
 * The sections of the home page (owner round 5, F-02 a; practice-core `home.ts` keys), each a self-contained block that
 * hides itself when it has nothing to show:
 * - «ورد اليوم» (members): the day's progress, a circle for each habit not yet logged (it logs right here, with
 *   «تراجع» in the toast; O-03), and «افتح ورد اليوم»;
 * - «نص اليوم» (F-23): one text a day from the source chosen on `practice/daily-text` (its «⋯» opens that picker);
 * - «شعبة الأسبوع» (F-18): one compact row;
 * - «مناسبة قريبة» (F-17): the next non-weekly occasion within ~10 days (hidden when none);
 * - «أبواب الخير» (F-10 a: honest labels «اقرأ في فضل الطاعات», «اقرأ في المعاصي وعلاجها»), «في لحظات مثل هذه»,
 *   «تذكرة مختارة» and «المصادر»;
 * and «خصّص الرئيسية»: the edit sheet (a switch and «أعلى» / «أسفل» per section), saved with practice-core
 * `setHomeSections` so it syncs.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  Heart,
  MessageCircle,
  Pause,
  Sprout,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import {
  correctLog,
  dailyPick,
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
import { useEvidence, usePracticeCatalog } from '@/lib/api/practice';
import { useReminderOfTheDay } from '@/lib/api/quotes';
import { useReminderSets } from '@/lib/api/reminder-sets';
import { useFavorites } from '@/lib/api/favorites';
import { useSourceStripNames } from '@/lib/api/sources';
import { doorLayout } from '@/lib/home/door-layout';
import { homeEditRows, moveSectionBy, toggleSection } from '@/lib/home/home-edit';
import { pick } from '@/lib/practice/catalog-types';
import { dayMonth } from '@/lib/practice/calendar-grid';
import { nextOccasion } from '@/lib/practice/habits-view';
import { today as todayFn, usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useAgendaRows, useDateNames, useDayAgenda, usePlanDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { QuoteLine } from '@/components/QuoteLine';
import { FeaturedReminder } from '@/components/home/FeaturedReminder';
import { SourceStrip } from '@/components/home/SourceStrip';
import { HabitRow } from '@/components/practice/hub/AgendaRows';
import { WeekBranchCard } from '@/components/practice/hub/KnowledgeCards';
import { radius, space, useStyles, type Theme } from '@/theme';
import {
  ActionMenu,
  BottomSheet,
  Button,
  ButtonPair,
  ForwardArrow,
  Icon,
  IconButton,
  ListRow,
  PathwayCard,
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
  doors: { gap: space.md, width: '100%' as const, alignSelf: 'center' as const },
  mainDoors: { gap: space.md },
  mainDoorsRow: { flexDirection: 'row' as const, alignItems: 'stretch' as const },
  mainDoorRow: { flex: 1 },
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

interface Moment {
  href: Href;
  labelKey: string;
  icon: LucideIcon;
}

/** The site's curated moments (frontend/src/components/home/Moments.tsx), on the app's topic routes. */
const MOMENTS: Moment[] = [
  { href: '/sins/ghadab', labelKey: 'home.momentAnger', icon: Pause },
  { href: '/good-deeds/salah', labelKey: 'home.momentPrayer', icon: Sun },
  { href: '/sins/ghibah', labelKey: 'home.momentBackbiting', icon: MessageCircle },
  { href: '/good-deeds/kalam-tayyib', labelKey: 'home.momentKindness', icon: Heart },
];

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
    case 'daily-text':
      return <DailyTextSection today={today} before={before} />;
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
      return <SourcesSection before={before} />;
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

// ── «نص اليوم» ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One text for today from the chosen source (the same `dailyPick` the widget uses): a reminder set, the saved texts,
 * the member's own lines, or one habit's texts. «مواسم الخير» (the old default, gone with F-17) reads the texts of the
 * member's habits, else the first reminder set.
 */
function DailyTextSection({ today, before }: { today: LocalDate } & Before) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const source = usePracticeStore((s) => s.prefs.todayText);
  const mine = usePracticeStore((s) => s.prefs.myReminders);
  const plans = usePracticeStore((s) => s.store.plans);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const sets = useReminderSets();
  const saved = useFavorites();
  const habitIds = useMemo(() => {
    if (source.kind === 'habit') return habits.find((h) => h.key === source.habitKey)?.evidence ?? [];
    if (source.kind === 'seasons') return plans.flatMap((p) => habitFor(p, habits)?.evidence ?? []);
    return [];
  }, [source, habits, plans]);
  const habitTexts = useEvidence(dailyPick(habitIds, today) ? [dailyPick(habitIds, today) as string] : [], locale);
  const title = useSectionTitle('daily-text');

  let body: React.ReactNode = null;
  if (source.kind === 'mine') {
    const line = dailyPick(mine, today);
    body = line ? (
      <Text variant="reading">{line.text}</Text>
    ) : (
      <Text variant="small" tone="muted">
        {t('homeSections.dailyText.mineEmpty')}
      </Text>
    );
  } else {
    const quotes =
      source.kind === 'set'
        ? (sets.data?.find((s) => s.slug === source.slug)?.items ?? [])
        : source.kind === 'saved'
          ? (saved.data ?? [])
          : habitIds.length > 0
            ? [...(habitTexts.data?.values() ?? [])]
            : (sets.data?.[0]?.items ?? []);
    const quote = habitIds.length > 0 && (source.kind === 'habit' || source.kind === 'seasons') ? quotes[0] : dailyPick(quotes, today);
    body = quote ? <QuoteLine quote={quote} numberOfLines={6} /> : null;
  }
  if (!body) return null;
  return (
    <>
      {before}
      <View style={styles.section}>
        <SectionHeader
          title={title}
          action={
            <ActionMenu
              label={t('homeSections.dailyText.menu')}
              items={[{ label: t('homeSections.dailyText.source'), icon: BookOpen, onPress: () => router.push('/practice/daily-text') }]}
            />
          }
        />
        {body}
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
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const layout = doorLayout(width);
  const twoUp = layout.columns === 2;
  const title = useSectionTitle('doors');
  return (
    <>
      {before}
      <View style={styles.section}>
        <SectionHeader title={title} />
        <View style={[styles.doors, { maxWidth: layout.maxWidth }]}>
          <View style={[styles.mainDoors, twoUp && styles.mainDoorsRow]}>
            <PathwayCard
              primary
              icon={Sprout}
              label={t('home.deedOverline')}
              title={t('home.deedEntryLabel')}
              body={t('home.deedEntryDescription')}
              action={t('home.deedCta')}
              onPress={() => router.push('/good-deeds')}
              layout={layout}
              style={twoUp ? styles.mainDoorRow : undefined}
            />
            <PathwayCard
              icon={DoorOpen}
              label={t('home.sinOverline')}
              title={t('home.sinEntryLabel')}
              body={t('home.sinEntryDescription')}
              action={t('home.sinCta')}
              onPress={() => router.push('/sins')}
              layout={layout}
              style={twoUp ? styles.mainDoorRow : undefined}
            />
          </View>
          <PathwayCard
            size="row"
            icon={BookOpen}
            title={t('home.branchEntryLabel')}
            body={t('home.branchEntryDescription')}
            action={t('home.branchCta')}
            onPress={() => router.push('/branches')}
          />
        </View>
      </View>
    </>
  );
}

function MomentsSection({ before }: Before) {
  const { t } = useTranslation();
  return (
    <>
      {before}
      <Section title={t('home.momentsHeading')}>
        <View>
          {MOMENTS.map((moment, i) => (
            <ListRow
              key={moment.labelKey}
              icon={moment.icon}
              title={t(moment.labelKey)}
              onPress={() => router.push(moment.href)}
              last={i === MOMENTS.length - 1}
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

function SourcesSection({ before }: Before) {
  const sources = useSourceStripNames();
  return (
    <>
      {before}
      <SourceStrip names={sources.data} isLoading={sources.isLoading} />
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
