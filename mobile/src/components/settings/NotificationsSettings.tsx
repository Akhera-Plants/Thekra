/**
 * «التنبيهات» (owner round 5, F-29 note «أعد صناعة الـUI», A-29 a, F-17, F-12 a, F-25 b): the channels only, in groups
 * separated by the flower divider, from the daily to the private:
 * «العادات» · «المحاسبة» (evening and weekly: each one switch = its card and its reminder, with its day and time as
 * value rows) · «الأعمال الدورية» · «تخفَّف» (a generic-title reminder; shown while a program runs or it is on) ·
 * «مناسبة قريبة» (opt-in, the evening before an occasion) · «تقويم المناسبات» (the public ICS feed) · the extension
 * link once its store page exists. Feature switches («نية اليوم», «التزام شخصي») live in their features, and the weekly
 * strategy reminder is gone. Every day and time is the same value row: the title on the reading start, the value on
 * the end, a tap opens a sheet (the system time picker; the seven days).
 *
 * The status line at the top says only what is true: how many reminders reach today (when some do), that every switch
 * is off, or that the phone does not allow notifications (with the way to its settings). Turning a reminder on asks for
 * the permission; refused, a combined switch still turns its card on and the status says why nothing rings.
 * Planning policy: practice-core `notificationPlan` (at most 4 a day then a digest, quiet 23:00–05:00).
 */

import React, { useCallback, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BellOff, CalendarPlus, ExternalLink, Laptop, MoonStar } from 'lucide-react-native';
import { setHeartPrefs, type HeartPrefs, type LocalTime } from '@thekra/practice-core';
import { useDisplayTime, WeekdayPicker } from '@/components/practice/editors';
import { TimePicker } from '@/components/practice/TimePicker';
import { calendarFeedUrl, usePracticeCatalog } from '@/lib/api/practice';
import { calendarSubscribeLink } from '@/lib/practice/calendar-grid';
import { nowTime } from '@/lib/practice/format';
import { ensurePermission, hasPermission } from '@/lib/practice/notifications';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { anyReminderOn, planReminders, remindersOn } from '@/lib/practice/reminders';
import { reminderTexts, useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { EXTENSION_STORE_URL } from '@/lib/site';
import { space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Icon, ListRow, Notice, SectionDivider, SectionHeader, SwitchRow, Text, TextLink } from '@/ui';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

const makeStyles = (t: Theme) => ({
  group: { gap: space.xs },
  switchRow: { paddingVertical: space.xs },
  /** What a switch opens (its day, its time): value rows right under it, one hairline list. */
  sub: { borderTopWidth: 1, borderTopColor: t.colors.border },
  status: { gap: space.xs },
});

/** One channel group: its title and its rows. */
function Group({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.group}>
      <SectionHeader title={title} lead={lead} size="heading" />
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

export function NotificationsSettings() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const hasProgram = usePracticeStore((s) => s.store.programs.some((p) => p.endedAt === undefined));
  const [denied, setDenied] = useState(false);
  const [pickingDay, setPickingDay] = useState(false);
  const [calendarFailed, setCalendarFailed] = useState(false);
  const setHeartPref = (patch: Partial<HeartPrefs>) => setHeart((h) => setHeartPrefs(h, patch));
  const timeLabel = t('practice.notifyPrefs.time');

  /** Turning a reminder on asks for the permission first; false when it was refused. */
  async function allowed(on: boolean): Promise<boolean> {
    setDenied(false);
    if (!on || (await ensurePermission(t('practice.notify.channelName')))) return true;
    setDenied(true);
    return false;
  }

  async function toggle(key: 'habitReminders' | 'kinshipReminders' | 'sinReminders' | 'occasionReminders', on: boolean) {
    if (await allowed(on)) setPrefs((p) => ({ ...p, [key]: on }));
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

  async function subscribeCalendar() {
    setCalendarFailed(false);
    try {
      await Linking.openURL(calendarSubscribeLink(calendarFeedUrl(locale), Platform.OS));
    } catch {
      setCalendarFailed(true);
    }
  }

  const eveningOn = heart.prefs.eveningReview || prefs.eveningNudge;
  const weeklyOn = heart.prefs.fridayReview || prefs.fridayReminder;
  const showPrivate = hasProgram || prefs.sinReminders;

  return (
    <>
      <StatusLine />
      {denied ? <Notice tone="destructive">{t('practice.permissionDenied')}</Notice> : null}

      <Group title={t('notifications.groups.habits')}>
        <View style={styles.switchRow}>
          <SwitchRow
            label={t('practice.notifyPrefs.habits')}
            hint={t('practice.notifyPrefs.habitsHint')}
            value={prefs.habitReminders}
            onValueChange={(v) => void toggle('habitReminders', v)}
          />
        </View>
      </Group>

      <SectionDivider />

      <Group title={t('notifications.groups.review')}>
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
      </Group>

      <SectionDivider />

      <Group title={t('notifications.groups.periodic')}>
        <View style={styles.switchRow}>
          <SwitchRow label={t('practice.notifyPrefs.periodic')} value={prefs.kinshipReminders} onValueChange={(v) => void toggle('kinshipReminders', v)} />
        </View>
        {prefs.kinshipReminders ? (
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
      </Group>

      {showPrivate ? (
        <>
          <SectionDivider />
          <Group title={t('notifications.groups.lighten')}>
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
          </Group>
        </>
      ) : null}

      <SectionDivider />

      <Group title={t('notifications.groups.occasion')}>
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
            <TimeValueRow label={timeLabel} value={prefs.occasionTime} onChange={(time) => setPrefs((p) => ({ ...p, occasionTime: time }))} />
          </View>
        ) : null}
        {/* The public occasions feed: no personal data, it updates itself in the calendar app (moved here, F-17). */}
        <ListRow
          icon={CalendarPlus}
          title={t('calendar.subscribe')}
          hint={t('calendar.subscribeHint')}
          trailing={<Icon icon={ExternalLink} size={18} tone="muted" />}
          onPress={() => void subscribeCalendar()}
          last={!EXTENSION_STORE_URL}
        />
        {calendarFailed ? <Notice tone="destructive">{t('calendar.openFailed')}</Notice> : null}
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

      <SectionDivider />
      <Notice icon={MoonStar}>{t('notifications.quiet')}</Notice>

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
    </>
  );
}
