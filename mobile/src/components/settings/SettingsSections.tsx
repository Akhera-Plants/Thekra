/**
 * The contents of the Settings group screens (app/settings/*): a titled group of hairline rows (`SettingsGroup`),
 * «الخصوصية والتشفير» (where «تخفَّف» is kept: always encrypted in the account; export, the offline copy),
 * «التنبيهات» (every reminder switch and time in titled groups, the only place for them), «اللغة والمظهر» and
 * «عن التطبيق». No «delete all data» here (owner, 2026-11-01): «تخفَّف» keeps its own one-tap wipe, and the account
 * deletion stays under «الحساب».
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Share, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import {
  BookOpen,
  CalendarDays,
  Database,
  Download,
  ExternalLink,
  FileText,
  HandHeart,
  Info,
} from 'lucide-react-native';
import { setHeartPrefs, type HeartPrefs } from '@thekra/practice-core';
import { TimeField, WeekdayPicker } from '@/components/practice/editors';
import { BottomSheet } from '@/components/practice/mujahada/Sheet';
import { exportAccountData } from '@/lib/api/practice';
import { ensurePermission, scheduledReminderCount } from '@/lib/practice/notifications';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { SITE_ABOUT_PATH, SITE_PRIVACY_PATH, sitePageUrl } from '@/lib/site';
import { useAuthStore } from '@/lib/stores/auth-store';
import { switchDirectionIfNeeded, type SupportedLocale } from '@/lib/i18n';
import { setApiLocale } from '@/lib/api-client';
import { space, useStyles, useTheme, useThemePreference, type Theme, type ThemePreference } from '@/theme';
import { VaultSignInNote, VaultStatusCard } from '@/components/practice/VaultCard';
import { ErrorText, Icon, ListRow, Notice, SegmentTabs, SwitchRow, Text, type SegmentItem } from '@/ui';

const QUERY_CACHE_KEY = 'thekra_query_cache';
const LOCALE_STORAGE_KEY = 'thekra_locale';
const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

const makeStyles = (t: Theme) => ({
  group: { gap: space.sm },
  head: { gap: 2 },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  switchRow: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  /** What a switch opens (its time, its day): under it, before the row's hairline. */
  sub: { gap: space.md, paddingTop: space.xs, paddingBottom: space.sm },
  choice: { gap: space.sm, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border },
});

/** A group of hairline rows; on a group's own screen the page title names it, so `title` is left out there. */
export function SettingsGroup({ title, lead, children }: { title?: string; lead?: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.group}>
      {title || lead ? (
        <View style={styles.head}>
          {title ? (
            <Text variant="eyebrow" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {lead ? (
            <Text variant="caption" tone="muted">
              {lead}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.list}>{children}</View>
    </View>
  );
}

export function PrivacySection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  async function handleExport() {
    setExporting(true);
    setExportError(false);
    try {
      const data = await exportAccountData();
      await Share.share({ message: JSON.stringify(data, null, 2) });
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  function handleClearCache() {
    Alert.alert(t('settings.clearCache'), t('settings.clearCacheConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.clearCache'),
        style: 'destructive',
        onPress: async () => {
          qc.clear();
          await AsyncStorage.removeItem(QUERY_CACHE_KEY);
        },
      },
    ]);
  }

  return (
    <>
      {/* «تخفَّف» is always kept encrypted in the account and opened with the fingerprint: one status line here. */}
      {userId ? <VaultStatusCard /> : <VaultSignInNote />}
      <SettingsGroup>
        {userId ? (
          <ListRow
            icon={Download}
            title={t('settings.exportData')}
            hint={t('settings.exportHint')}
            chevron
            onPress={exporting ? undefined : () => void handleExport()}
            trailing={exporting ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
          />
        ) : null}
        {exportError ? <ErrorText>{t('settings.exportFailed')}</ErrorText> : null}
        <ListRow icon={Database} title={t('settings.clearCache')} hint={t('settings.clearCacheHint')} chevron onPress={handleClearCache} />
      </SettingsGroup>
    </>
  );
}

/**
 * «التنبيهات والتذكير» (redesign §4.4; owner round 4): the one place for every reminder on this device (practice-core
 * `notificationPlan`: at most 4 a day then a digest, quiet 23:00–05:00), in titled groups from the daily to the private:
 * «تذكيرات العادات»; «المحاسبة» (one switch per review = its card and its reminder, with the review's own time and, for
 * the weekly one, its day; «التزام شخصي»); «تخفَّف»; «الاستراتيجيات» (only once some are chosen, on their page).
 * Turning a reminder on asks for the permission; refused, a combined switch still turns its card on and says so.
 */
export function NotificationsSection() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const hasProgram = usePracticeStore((s) => s.store.programs.length > 0);
  const [count, setCount] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [pickingDay, setPickingDay] = useState(false);
  const setHeartPref = (patch: Partial<HeartPrefs>) => setHeart((h) => setHeartPrefs(h, patch));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void scheduledReminderCount().then((n) => {
        if (active) setCount(n);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  /** Turning a reminder on asks for the permission first; false when it was refused. */
  async function allowed(on: boolean): Promise<boolean> {
    setDenied(false);
    if (!on || (await ensurePermission(t('practice.notify.channelName')))) return true;
    setDenied(true);
    return false;
  }

  async function toggle(key: 'habitReminders' | 'kinshipReminders' | 'sinReminders' | 'strategyReminders', on: boolean) {
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

  const eveningOn = heart.prefs.eveningReview || prefs.eveningNudge;
  const weeklyOn = heart.prefs.fridayReview || prefs.fridayReminder;
  const timeLabel = t('practice.notifyPrefs.time');

  return (
    <>
      {count !== null ? (
        <Text variant="small" tone="muted">
          {t('settings.remindersCount', { count })}
        </Text>
      ) : null}
      {denied ? <Notice tone="destructive">{t('practice.permissionDenied')}</Notice> : null}

      <SettingsGroup title={t('practice.notifyPrefs.groupHabits')}>
        <View style={styles.switchRow}>
          <SwitchRow
            label={t('practice.notifyPrefs.habits')}
            hint={t('practice.notifyPrefs.habitsHint')}
            value={prefs.habitReminders}
            onValueChange={(v) => void toggle('habitReminders', v)}
          />
        </View>
        <View style={styles.switchRow}>
          <SwitchRow label={t('practice.notifyPrefs.periodic')} value={prefs.kinshipReminders} onValueChange={(v) => void toggle('kinshipReminders', v)} />
          {prefs.kinshipReminders ? (
            <View style={styles.sub}>
              <SwitchRow
                label={t('kinship.showNames')}
                hint={t('kinship.showNamesHint')}
                value={prefs.kinshipShowNames}
                onValueChange={(v) => setPrefs((p) => ({ ...p, kinshipShowNames: v }))}
              />
              <TimeField label={timeLabel} value={prefs.kinshipTime} onChange={(time) => setPrefs((p) => ({ ...p, kinshipTime: time }))} />
            </View>
          ) : null}
        </View>
      </SettingsGroup>

      <SettingsGroup title={t('practice.notifyPrefs.groupReview')}>
        <View style={styles.switchRow}>
          <SwitchRow label={t('practice.notifyPrefs.intention')} value={heart.prefs.intention} onValueChange={(v) => setHeartPref({ intention: v })} />
        </View>
        <View style={styles.switchRow}>
          <SwitchRow label={t('practice.notifyPrefs.eveningReview')} value={eveningOn} onValueChange={(v) => void toggleEvening(v)} />
          {eveningOn ? (
            <View style={styles.sub}>
              <TimeField
                label={timeLabel}
                value={heart.prefs.eveningFrom}
                onChange={(time) => {
                  setHeartPref({ eveningFrom: time });
                  setPrefs((p) => ({ ...p, eveningTime: time }));
                }}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.switchRow}>
          <SwitchRow label={t('practice.notifyPrefs.fridayReview')} value={weeklyOn} onValueChange={(v) => void toggleWeekly(v)} />
          {weeklyOn ? (
            <View style={styles.sub}>
              {/* One row with the chosen day; the seven days open in a small sheet that closes on a choice. */}
              <ListRow
                icon={CalendarDays}
                title={t('practice.notifyPrefs.reviewDay')}
                value={t(`practice.weekdays.${heart.prefs.reviewDay}`)}
                chevron
                onPress={() => setPickingDay(true)}
              />
              <TimeField label={timeLabel} value={prefs.fridayTime} onChange={(time) => setPrefs((p) => ({ ...p, fridayTime: time }))} />
            </View>
          ) : null}
        </View>
        <View style={styles.switchRow}>
          <SwitchRow
            label={t('practice.notifyPrefs.pledges')}
            hint={t('practice.notifyPrefs.pledgesHint')}
            value={heart.prefs.pledges}
            onValueChange={(v) => setHeartPref({ pledges: v })}
          />
        </View>
        {heart.prefs.pledges ? (
          <ListRow
            icon={HandHeart}
            title={t('practice.notifyPrefs.pledgesList')}
            value={String(heart.pledges.length)}
            chevron
            onPress={() => router.push('/practice/pledges')}
          />
        ) : null}
      </SettingsGroup>

      {hasProgram || prefs.sinReminders ? (
        <>
          <SettingsGroup title={t('practice.notifyPrefs.groupVault')}>
            <View style={styles.switchRow}>
              <SwitchRow
                label={t('practice.notifyPrefs.private')}
                hint={t('practice.notifyPrefs.privateHint')}
                value={prefs.sinReminders}
                onValueChange={(v) => void toggle('sinReminders', v)}
              />
              {prefs.sinReminders ? (
                <View style={styles.sub}>
                  <TimeField label={timeLabel} value={prefs.sinReminderTime} onChange={(time) => setPrefs((p) => ({ ...p, sinReminderTime: time }))} />
                </View>
              ) : null}
            </View>
          </SettingsGroup>
        </>
      ) : null}

      {/* The strategies are chosen on their own page («عاداتي»); only their weekly reminder lives here. */}
      {prefs.strategies.length > 0 ? (
        <>
          <SettingsGroup title={t('practice.notifyPrefs.groupStrategies')}>
            <View style={styles.switchRow}>
              <SwitchRow
                label={t('practice.notifyPrefs.strategyWeekly')}
                value={prefs.strategyReminders}
                onValueChange={(v) => void toggle('strategyReminders', v)}
              />
              {prefs.strategyReminders ? (
                <View style={styles.sub}>
                  <TimeField label={timeLabel} value={prefs.strategyTime} onChange={(time) => setPrefs((p) => ({ ...p, strategyTime: time }))} />
                </View>
              ) : null}
            </View>
          </SettingsGroup>
        </>
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
    </>
  );
}

/** Theme (device, light, dark) and language, each a segmented choice like the site's; «إظهار التاريخ الهجري»; «شعبة الأسبوع»; «نص اليوم». */
export function AppearanceSection() {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const themePref = useThemePreference((s) => s.pref);
  const setThemePref = useThemePreference((s) => s.setPref);
  const currentLocale: SupportedLocale = i18n.language === 'en' ? 'en' : 'ar';
  const showHijri = usePracticeStore((s) => s.prefs.showHijri);
  const weekBranch = usePracticeStore((s) => s.prefs.weekBranch);
  const setPrefs = usePracticeStore((s) => s.setPrefs);

  const themeItems: SegmentItem<ThemePreference>[] = THEME_OPTIONS.map((key) => ({ key, label: t(`theme.${key}`) }));
  const localeItems: SegmentItem<SupportedLocale>[] = [
    { key: 'ar', label: t('settings.languageAr') },
    { key: 'en', label: t('settings.languageEn') },
  ];

  async function changeLocale(locale: SupportedLocale) {
    if (locale === currentLocale) return;
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
    // A direction change reloads the app now; the start-up reads the saved locale.
    if (await switchDirectionIfNeeded(locale)) return;
    await i18n.changeLanguage(locale);
    setApiLocale(locale);
  }

  return (
    <SettingsGroup>
      <View style={styles.choice}>
        <Text variant="label">{t('theme.title')}</Text>
        <SegmentTabs items={themeItems} value={themePref} onChange={setThemePref} />
      </View>
      <View style={styles.choice}>
        <Text variant="label">{t('settings.language')}</Text>
        <SegmentTabs items={localeItems} value={currentLocale} onChange={(locale) => void changeLocale(locale)} />
      </View>
      <View style={styles.switchRow}>
        <SwitchRow
          label={t('settings.showHijri')}
          value={showHijri}
          onValueChange={(on) => setPrefs((p) => ({ ...p, showHijri: on }))}
        />
      </View>
      {/* «شعبة الأسبوع» on «ورد اليوم» only for a member who chose to study the branches of faith (owner round 3). */}
      <View style={styles.switchRow}>
        <SwitchRow
          label={t('settings.weekBranch')}
          hint={t('settings.weekBranchHint')}
          value={weekBranch}
          onValueChange={(on) => setPrefs((p) => ({ ...p, weekBranch: on }))}
        />
      </View>
      {/* The widget's «نص اليوم» source: part of how the app shows itself on the device. */}
      <ListRow icon={BookOpen} title={t('dailyText.title')} chevron onPress={() => router.push('/practice/daily-text')} />
    </SettingsGroup>
  );
}

/** The site's pages open in the browser; the version is the app's own. */
export function AboutSection() {
  const { t, i18n } = useTranslation();
  const version = Constants.expoConfig?.version ?? '0.1.0';
  const openSite = (path: string) => () => void Linking.openURL(sitePageUrl(path, i18n.language)).catch(() => undefined);
  const external = <Icon icon={ExternalLink} size={18} tone="muted" />;

  return (
    <SettingsGroup>
      <ListRow icon={BookOpen} title={t('settings.aboutThekra')} onPress={openSite(SITE_ABOUT_PATH)} trailing={external} />
      <ListRow icon={FileText} title={t('settings.privacyPolicy')} onPress={openSite(SITE_PRIVACY_PATH)} trailing={external} />
      <ListRow icon={Info} title={t('settings.version')} value={version} />
    </SettingsGroup>
  );
}
