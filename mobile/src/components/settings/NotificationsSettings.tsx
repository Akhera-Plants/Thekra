/**
 * «التنبيهات» (owner round 6, C-19: «as the reference has it», one tab each; practice-core `NOTIFICATION_GROUPS`):
 * - «العادات»: the habit reminders' switch, then one row per habit with its own switch (`mutedPlans`; its times are set
 *   on the habit page), and the generic «تخفَّف» reminder while a program runs;
 * - «الأعمال الدورية»: only the member's active acts (practice-core `activePeriodicActs`), each with its switch
 *   (`mutedActs`); «صلة الرحم والأحباب» has the people-list time and «show names»; none active → one add button;
 *   «مناسبة قريبة» (opt-in);
 * - «النية والمحاسبة»: «نية اليوم» (opt-in), «محاسبة المساء» and «المحاسبة الأسبوعية» (each one switch = its card and
 *   its reminder, with its day and time as value rows);
 * - «الاستراتيجيات»: the strategies reminded, one a week rotating, on the chosen day and time.
 * No calendar (ICS) file any more (C-19). Every day and time is the same value row: the title on the reading start,
 * the value on the end, a tap opens a sheet (the system time picker; the seven days).
 *
 * The status line at the top says only what is true: how many reminders reach today (when some do), that every switch
 * is off, or that the phone does not allow notifications (with the way to its settings). Turning a reminder on asks for
 * the permission; refused, a combined switch still turns its card on and the status says why nothing rings.
 * Planning policy: practice-core `notificationPlan` (at most 4 a day then a digest, quiet 23:00–05:00).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BellOff, ExternalLink, Laptop, MoonStar, Plus } from 'lucide-react-native';
import {
  activePeriodicActs,
  isArchived,
  isPeriodicPlan,
  listedStrategies,
  periodicActKeyOf,
  reminderSlots,
  setHeartPrefs,
  toggleStrategy,
  type HeartPrefs,
  type LocalTime,
} from '@thekra/practice-core';
import { useDisplayTime, WeekdayPicker } from '@/components/practice/editors';
import { TimePicker } from '@/components/practice/TimePicker';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { habitFor } from '@/lib/practice/reminders';
import { nowTime } from '@/lib/practice/format';
import { ensurePermission, hasPermission } from '@/lib/practice/notifications';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { anyReminderOn, planReminders, remindersOn } from '@/lib/practice/reminders';
import { router } from 'expo-router';
import { reminderTexts, useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { EXTENSION_STORE_URL } from '@/lib/site';
import { space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, Icon, ListRow, Notice, SectionDivider, SectionHeader, SwitchRow, Text, TextLink, UnderlineTabs, type SegmentItem } from '@/ui';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

const makeStyles = (t: Theme) => ({
  group: { gap: space.xs },
  switchRow: { paddingVertical: space.xs },
  /** What a switch opens (its day, its time): value rows right under it, one hairline list. */
  sub: { borderTopWidth: 1, borderTopColor: t.colors.border },
  status: { gap: space.xs },
});

/** One channel group: its title and its rows. */
function Group({ title, lead, children }: { title?: string; lead?: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.group}>
      {title ? <SectionHeader title={title} lead={lead} size="heading" /> : lead ? <Text variant="small" tone="muted">{lead}</Text> : null}
      {children}
    </View>
  );
}

/** A time as a value row (A-29 a): «الوقت» on the start, the time on the end; a tap opens the system picker. */
export function TimeValueRow({ label, value, onChange, last }: { label: string; value: LocalTime; onChange: (time: LocalTime) => void; last?: boolean }) {
  const show = useDisplayTime();
  return (
    <TimePicker
      value={value}
      title={label}
      onPick={onChange}
      renderTrigger={(open) => <ListRow title={label} value={show(value)} chevron onPress={open} last={last} />}
    />
  );
}

/** «ستصلك اليوم n تذكيرات» / «التنبيهات كلها متوقفة» / the permission is missing: only what is true (F-29 a). */
function StatusLine() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const prefs = usePracticeStore((s) => s.prefs);
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const catalog = usePracticeCatalog(locale);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void hasPermission().then((ok) => {
        if (active) setAllowed(ok);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  if (!anyReminderOn(prefs)) {
    return <Notice icon={BellOff}>{t('notifications.status.allOff')}</Notice>;
  }
  if (!supported) return null;
  if (allowed === false) {
    return (
      <View style={styles.status}>
        <Notice icon={BellOff} tone="destructive">
          {t('notifications.status.denied')}
        </Notice>
        <TextLink label={t('notifications.status.openSettings')} onPress={() => void Linking.openSettings().catch(() => undefined)} />
      </View>
    );
  }
  if (allowed === null) return null;
  const d = today();
  const planned = planReminders({
    store,
    prefs,
    habits: catalog.data?.habits ?? [],
    today: d,
    now: nowTime(),
    locale,
    texts: reminderTexts(t as unknown as Parameters<typeof reminderTexts>[0], locale),
    days: 1,
    reviewDay: heart.prefs.reviewDay,
    reviewDoneOn: (day) => !heart.prefs.fridayReview || heart.weekly.some((w) => w.weekOf === day),
    intentionDoneOn: (day) => heart.intentions.some((i) => i.date === day),
    occasions: catalog.data?.occasions,
  });
  const count = remindersOn(planned, d);
  // Nothing left today is not a fault: no line rather than a «none scheduled» that reads as broken.
  if (count === 0) return null;
  return (
    <Text variant="small" tone="muted">
      {t('notifications.status.today', { count })}
    </Text>
  );
}

type NotifyTab = 'habits' | 'periodic' | 'heart' | 'strategies';
const TABS: readonly NotifyTab[] = ['habits', 'periodic', 'heart', 'strategies'];

export function NotificationsSettings() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<NotifyTab>('habits');
  const [denied, setDenied] = useState(false);
  const items: SegmentItem<NotifyTab>[] = TABS.map((key) => ({ key, label: t(`notifications.tabs.${key}`) }));

  /** Turning a reminder on asks for the permission first; false when it was refused. */
  async function allowed(on: boolean): Promise<boolean> {
    setDenied(false);
    if (!on || (await ensurePermission(t('practice.notify.channelName')))) return true;
    setDenied(true);
    return false;
  }

  return (
    <>
      <StatusLine />
      {denied ? <Notice tone="destructive">{t('practice.permissionDenied')}</Notice> : null}
      <UnderlineTabs dense items={items} value={tab} onChange={setTab} accessibilityLabel={t('settings.groups.notifications')} />
      {tab === 'habits' ? <HabitsTab allowed={allowed} /> : null}
      {tab === 'periodic' ? <PeriodicTab allowed={allowed} /> : null}
      {tab === 'heart' ? <HeartTab allowed={allowed} /> : null}
      {tab === 'strategies' ? <StrategiesTab allowed={allowed} /> : null}
      <SectionDivider />
      <Notice icon={MoonStar}>{t('notifications.quiet')}</Notice>
    </>
  );
}

type Allowed = (on: boolean) => Promise<boolean>;

/** Adds or removes one id of a mute list. */
function muted(list: readonly string[], id: string, mute: boolean): string[] {
  const rest = list.filter((x) => x !== id);
  return mute ? [...rest, id] : rest;
}

/** «العادات»: the switch, one row per habit (its own switch), the generic «تخفَّف» reminder. */
function HabitsTab({ allowed }: { allowed: Allowed }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const show = useDisplayTime();
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const plans = usePracticeStore((s) => s.store.plans);
  const hasProgram = usePracticeStore((s) => s.store.programs.some((p) => p.endedAt === undefined));
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  // Habits only: a periodic act (catalog or custom) is listed in its own tab.
  // Archived habits send nothing, so they are not listed (only the active ones, C-19).
  const rows = plans.filter((p) => !isArchived(p) && periodicActKeyOf(p) === null && !isPeriodicPlan(p, { defaultRuleOf: (plan) => habitFor(plan, habits)?.defaultRule }));
  const timeLabel = t('practice.notifyPrefs.time');
  const showPrivate = hasProgram || prefs.sinReminders;

  async function toggle(key: 'habitReminders' | 'sinReminders', on: boolean) {
    if (await allowed(on)) setPrefs((p) => ({ ...p, [key]: on }));
  }

  return (
    <Group>
      <View style={styles.switchRow}>
        <SwitchRow
          label={t('practice.notifyPrefs.habits')}
          hint={t('practice.notifyPrefs.habitsHint')}
          value={prefs.habitReminders}
          onValueChange={(v) => void toggle('habitReminders', v)}
        />
      </View>
      {prefs.habitReminders && rows.length > 0 ? (
        <View style={styles.sub}>
          {rows.map((plan) => {
            const habit = habitFor(plan, habits);
            const title = habit ? pick(habit, 'title', locale) : plan.title;
            const slots = reminderSlots(plan);
            return (
              <View key={plan.id} style={styles.switchRow}>
                <SwitchRow
                  label={title}
                  hint={slots.length > 0 ? slots.map(show).join(' · ') : t('notifications.habit.noTime')}
                  value={!prefs.mutedPlans.includes(plan.id)}
                  onValueChange={(on) => setPrefs((p) => ({ ...p, mutedPlans: muted(p.mutedPlans, plan.id, !on) }))}
                />
              </View>
            );
          })}
          <Text variant="caption" tone="muted">
            {t('notifications.habit.timesHint')}
          </Text>
        </View>
      ) : null}
      {showPrivate ? (
        <>
          <View style={styles.switchRow}>
            <SwitchRow
              label={t('practice.notifyPrefs.private')}
              hint={t('practice.notifyPrefs.privateHint')}
              value={prefs.sinReminders}
              onValueChange={(v) => void toggle('sinReminders', v)}
            />
          </View>
          {prefs.sinReminders ? (
            <View style={styles.sub}>
              <TimeValueRow label={timeLabel} value={prefs.sinReminderTime} last onChange={(time) => setPrefs((p) => ({ ...p, sinReminderTime: time }))} />
            </View>
          ) : null}
        </>
      ) : null}
      {/* «تذكير على حاسوبك» once the owner publishes the extension (F-25 b); hidden until then. */}
      {EXTENSION_STORE_URL ? (
        <ListRow
          icon={Laptop}
          title={t('notifications.extension.title')}
          hint={t('notifications.extension.hint')}
          trailing={<Icon icon={ExternalLink} size={18} tone="muted" />}
          onPress={() => void Linking.openURL(EXTENSION_STORE_URL as string).catch(() => undefined)}
          last
        />
      ) : null}
    </Group>
  );
}

/** «الأعمال الدورية»: only the active acts, each with its switch; none → an add button; «مناسبة قريبة». */
function PeriodicTab({ allowed }: { allowed: Allowed }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const plans = usePracticeStore((s) => s.store.plans);
  const relatives = usePracticeStore((s) => s.store.relatives);
  const acts = useMemo(() => activePeriodicActs({ plans, relatives }), [plans, relatives]);
  const timeLabel = t('practice.notifyPrefs.time');

  async function toggle(key: 'kinshipReminders' | 'occasionReminders' | 'habitReminders', on: boolean) {
    if (await allowed(on)) setPrefs((p) => ({ ...p, [key]: on }));
  }

  /** One act's switch: the people lists also need the people reminder on; a plan's act needs the habit reminders on. */
  async function toggleAct(key: string, people: boolean, on: boolean) {
    if (on && !(await allowed(true))) return;
    setPrefs((p) => ({
      ...p,
      mutedActs: muted(p.mutedActs, key, !on),
      ...(on && people ? { kinshipReminders: true } : {}),
      ...(on && !people ? { habitReminders: true } : {}),
    }));
  }

  return (
    <Group>
      {acts.length === 0 ? (
        <View style={styles.status}>
          <Text variant="small" tone="muted">
            {t('notifications.periodic.none')}
          </Text>
          <Button label={t('notifications.periodic.add')} icon={Plus} variant="outline" onPress={() => router.push('/habits?tab=periodic')} />
        </View>
      ) : (
        acts.map((act) => {
          const people = act.key === 'silat';
          const title = act.info ? act.info[locale] : (act.plans[0]?.title ?? '');
          const on = !prefs.mutedActs.includes(act.key) && (people ? prefs.kinshipReminders : prefs.habitReminders);
          return (
            <View key={act.key}>
              <View style={styles.switchRow}>
                <SwitchRow label={title} value={on} onValueChange={(v) => void toggleAct(act.key, people, v)} />
              </View>
              {people && on ? (
                <View style={styles.sub}>
                  <TimeValueRow label={timeLabel} value={prefs.kinshipTime} onChange={(time) => setPrefs((p) => ({ ...p, kinshipTime: time }))} />
                  <View style={styles.switchRow}>
                    <SwitchRow
                      label={t('kinship.showNames')}
                      hint={t('kinship.showNamesHint')}
                      value={prefs.kinshipShowNames}
                      onValueChange={(v) => setPrefs((p) => ({ ...p, kinshipShowNames: v }))}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })
      )}
      <SectionDivider />
      <SectionHeader title={t('notifications.groups.occasion')} size="heading" />
      <View style={styles.switchRow}>
        <SwitchRow
          label={t('notifications.occasion.label')}
          hint={t('notifications.occasion.hint')}
          value={prefs.occasionReminders}
          onValueChange={(v) => void toggle('occasionReminders', v)}
        />
      </View>
      {prefs.occasionReminders ? (
        <View style={styles.sub}>
          <TimeValueRow label={timeLabel} value={prefs.occasionTime} last onChange={(time) => setPrefs((p) => ({ ...p, occasionTime: time }))} />
        </View>
      ) : null}
    </Group>
  );
}

/** «النية والمحاسبة»: «نية اليوم», «محاسبة المساء», «المحاسبة الأسبوعية». */
function HeartTab({ allowed }: { allowed: Allowed }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const [pickingDay, setPickingDay] = useState(false);
  const setHeartPref = (patch: Partial<HeartPrefs>) => setHeart((h) => setHeartPrefs(h, patch));
  const timeLabel = t('practice.notifyPrefs.time');
  const eveningOn = heart.prefs.eveningReview || prefs.eveningNudge;
  const weeklyOn = heart.prefs.fridayReview || prefs.fridayReminder;

  async function toggleIntention(on: boolean) {
    if (await allowed(on)) setPrefs((p) => ({ ...p, intentionReminder: on }));
  }

  /** «محاسبة المساء»: the card from the chosen time and its reminder at the same time. */
  async function toggleEvening(on: boolean) {
    setHeartPref({ eveningReview: on });
    const ok = await allowed(on);
    setPrefs((p) => ({ ...p, eveningNudge: on && ok, eveningTime: heart.prefs.eveningFrom }));
  }

  /** «المحاسبة الأسبوعية»: the card on the chosen day and its reminder. */
  async function toggleWeekly(on: boolean) {
    setHeartPref({ fridayReview: on });
    const ok = await allowed(on);
    setPrefs((p) => ({ ...p, fridayReminder: on && ok }));
  }

  return (
    <Group>
      <View style={styles.switchRow}>
        <SwitchRow label={t('practice.notifyPrefs.intention')} value={prefs.intentionReminder} onValueChange={(v) => void toggleIntention(v)} />
      </View>
      {prefs.intentionReminder ? (
        <View style={styles.sub}>
          <TimeValueRow label={timeLabel} value={prefs.intentionTime} onChange={(time) => setPrefs((p) => ({ ...p, intentionTime: time }))} />
        </View>
      ) : null}
      <View style={styles.switchRow}>
        <SwitchRow label={t('practice.notifyPrefs.eveningReview')} value={eveningOn} onValueChange={(v) => void toggleEvening(v)} />
      </View>
      {eveningOn ? (
        <View style={styles.sub}>
          <TimeValueRow
            label={timeLabel}
            value={heart.prefs.eveningFrom}
            onChange={(time) => {
              setHeartPref({ eveningFrom: time });
              setPrefs((p) => ({ ...p, eveningTime: time }));
            }}
          />
        </View>
      ) : null}
      <View style={styles.switchRow}>
        <SwitchRow label={t('practice.notifyPrefs.fridayReview')} value={weeklyOn} onValueChange={(v) => void toggleWeekly(v)} />
      </View>
      {weeklyOn ? (
        <View style={styles.sub}>
          {/* The day and the time: the same value row, each opening its sheet (A-29 a). */}
          <ListRow
            title={t('practice.notifyPrefs.reviewDay')}
            value={t(`practice.weekdays.${heart.prefs.reviewDay}`)}
            chevron
            onPress={() => setPickingDay(true)}
          />
          <TimeValueRow label={timeLabel} value={prefs.fridayTime} last onChange={(time) => setPrefs((p) => ({ ...p, fridayTime: time }))} />
        </View>
      ) : null}
      <BottomSheet visible={pickingDay} title={t('practice.notifyPrefs.reviewDay')} onClose={() => setPickingDay(false)}>
        <WeekdayPicker
          single
          value={[heart.prefs.reviewDay]}
          onChange={(days) => {
            setHeartPref({ reviewDay: days[0] ?? heart.prefs.reviewDay });
            setPickingDay(false);
          }}
        />
      </BottomSheet>
    </Group>
  );
}

/** «الاستراتيجيات»: one idea a week, rotating the chosen strategies, on the chosen day and time. */
function StrategiesTab({ allowed }: { allowed: Allowed }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [pickingDay, setPickingDay] = useState(false);
  const timeLabel = t('practice.notifyPrefs.time');

  async function toggle(key: string, on: boolean) {
    if (on && !(await allowed(true))) return;
    setPrefs((p) => ({ ...p, weeklyStrategies: toggleStrategy(p.weeklyStrategies, key) }));
  }

  return (
    <Group lead={t('notifications.strategies.lead')}>
      <View>
        {listedStrategies().map((strategy) => (
          <View key={strategy.key} style={styles.switchRow}>
            <SwitchRow
              label={locale === 'en' ? strategy.titleEn : strategy.titleAr}
              value={prefs.weeklyStrategies.includes(strategy.key)}
              onValueChange={(v) => void toggle(strategy.key, v)}
            />
          </View>
        ))}
      </View>
      {/* The day and time under the list, as on the website. */}
      {prefs.weeklyStrategies.length > 0 ? (
        <View style={styles.sub}>
          <ListRow
            title={t('notifications.strategies.day')}
            value={t(`practice.weekdays.${prefs.strategyDay}`)}
            chevron
            onPress={() => setPickingDay(true)}
          />
          <TimeValueRow label={timeLabel} value={prefs.strategyTime} last onChange={(time) => setPrefs((p) => ({ ...p, strategyTime: time }))} />
        </View>
      ) : null}
      <TextLink label={t('practice.notifyPrefs.strategiesLink')} onPress={() => router.push('/practice/strategies')} />
      <BottomSheet visible={pickingDay} title={t('notifications.strategies.day')} onClose={() => setPickingDay(false)}>
        <WeekdayPicker
          single
          value={[prefs.strategyDay]}
          onChange={(days) => {
            setPrefs((p) => ({ ...p, strategyDay: days[0] ?? p.strategyDay }));
            setPickingDay(false);
          }}
        />
      </BottomSheet>
    </Group>
  );
}
