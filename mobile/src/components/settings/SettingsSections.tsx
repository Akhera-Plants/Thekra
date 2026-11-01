/**
 * The contents of the Settings group screens (app/settings/*): a titled group of hairline rows (`SettingsGroup`),
 * «الخصوصية والتشفير» (the sin-program lock, the encrypted saving of every «تخفَّف» program, export, the offline copy),
 * «التنبيهات» (every reminder switch and time, the only place for them), «نية اليوم والمحاسبة», «اللغة والمظهر» and
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
  Database,
  Download,
  ExternalLink,
  FileText,
  HandHeart,
  Info,
} from 'lucide-react-native';
import { setHeartPrefs, type HeartPrefs } from '@thekra/practice-core';
import { TimeField } from '@/components/practice/editors';
import { exportAccountData } from '@/lib/api/practice';
import { ensurePermission, scheduledReminderCount } from '@/lib/practice/notifications';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { unlockWithDevice, useDeviceLockAvailable } from '@/lib/practice/use-sin-privacy';
import { SITE_ABOUT_PATH, SITE_PRIVACY_PATH, sitePageUrl } from '@/lib/site';
import { useAuthStore } from '@/lib/stores/auth-store';
import { switchDirectionIfNeeded, type SupportedLocale } from '@/lib/i18n';
import { setApiLocale } from '@/lib/api-client';
import { space, useStyles, useTheme, useThemePreference, type Theme, type ThemePreference } from '@/theme';
import { VaultCard, VaultSignInNote } from '@/components/practice/VaultCard';
import { ErrorText, Icon, ListRow, Notice, SegmentTabs, SwitchRow, Text, type SegmentItem } from '@/ui';

const QUERY_CACHE_KEY = 'thekra_query_cache';
const LOCALE_STORAGE_KEY = 'thekra_locale';
const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

const makeStyles = (t: Theme) => ({
  group: { gap: space.sm },
  head: { gap: 2 },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  switchRow: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
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
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const lockOn = usePracticeStore((s) => s.prefs.sinLock);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const hasProgram = usePracticeStore((s) => s.store.programs.length > 0);
  const lockAvailable = useDeviceLockAvailable();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  // Switching the lock either way asks the device first, so no one else can turn it off.
  async function handleLockChange(on: boolean) {
    const confirmed = await unlockWithDevice({ promptMessage: t('sinLock.confirmPrompt'), cancelLabel: t('common.cancel') });
    if (confirmed) setPrefs((p) => ({ ...p, sinLock: on }));
  }

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
      {lockAvailable || lockOn ? (
        <SettingsGroup title={t('sinProgram.title')}>
          <View style={styles.switchRow}>
            <SwitchRow
              label={t('sinLock.switch')}
              hint={t('sinLock.switchHint')}
              value={lockOn}
              onValueChange={(on) => void handleLockChange(on)}
            />
          </View>
        </SettingsGroup>
      ) : null}
      {/* One encrypted saving for every «تخفَّف» program, managed here only. */}
      {userId ? <VaultCard userId={userId} hasProgram={hasProgram} /> : <VaultSignInNote />}
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
 * «التنبيهات» (redesign §4.4): the one place for every reminder switch and time on this device (practice-core
 * `notificationPlan`: at most 4 a day then a digest, quiet 23:00–05:00), with the scheduled count; then «نية اليوم
 * والمحاسبة» (device-local) and «التزام شخصي». The permission is asked when a switch is turned on.
 */
export function NotificationsSection() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const hasProgram = usePracticeStore((s) => s.store.programs.length > 0);
  const [count, setCount] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);

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

  /** Turning a switch on asks for the permission first; a refusal leaves it off. */
  async function toggle(key: 'habitReminders' | 'kinshipReminders' | 'eveningNudge' | 'fridayReminder' | 'sinReminders', on: boolean) {
    setDenied(false);
    if (on && !(await ensurePermission(t('practice.notify.channelName')))) {
      setDenied(true);
      return;
    }
    setPrefs((p) => ({ ...p, [key]: on }));
  }

  const row = (label: string, key: Parameters<typeof toggle>[0], extra?: React.ReactNode) => (
    <View style={styles.switchRow}>
      <SwitchRow label={label} value={prefs[key]} onValueChange={(v) => void toggle(key, v)} />
      {prefs[key] ? extra : null}
    </View>
  );

  return (
    <SettingsGroup
      lead={count === null ? undefined : t('settings.remindersCount', { count })}
    >
      {row(t('practice.notifyPrefs.habits'), 'habitReminders')}
      {row(
        t('practice.notifyPrefs.periodic'),
        'kinshipReminders',
        <>
          <SwitchRow
            label={t('kinship.showNames')}
            hint={t('kinship.showNamesHint')}
            value={prefs.kinshipShowNames}
            onValueChange={(v) => setPrefs((p) => ({ ...p, kinshipShowNames: v }))}
          />
          <TimeField label={t('practice.notifyPrefs.time')} value={prefs.kinshipTime} onChange={(time) => setPrefs((p) => ({ ...p, kinshipTime: time }))} />
        </>,
      )}
      {row(
        t('practice.notifyPrefs.evening'),
        'eveningNudge',
        <TimeField label={t('practice.notifyPrefs.time')} value={prefs.eveningTime} onChange={(time) => setPrefs((p) => ({ ...p, eveningTime: time }))} />,
      )}
      {row(
        t('practice.notifyPrefs.friday'),
        'fridayReminder',
        <TimeField label={t('practice.notifyPrefs.time')} value={prefs.fridayTime} onChange={(time) => setPrefs((p) => ({ ...p, fridayTime: time }))} />,
      )}
      {hasProgram || prefs.sinReminders
        ? row(
            t('practice.notifyPrefs.private'),
            'sinReminders',
            <TimeField label={t('practice.notifyPrefs.time')} value={prefs.sinReminderTime} onChange={(time) => setPrefs((p) => ({ ...p, sinReminderTime: time }))} />,
          )
        : null}
      {/* «ذكّرني بها»: chosen on «استراتيجيات العادات»; one a week at most, on Saturday at this time. */}
      <ListRow
        title={t('practice.notifyPrefs.strategiesLink')}
        hint={t('practice.notifyPrefs.strategies', { count: prefs.strategies.length })}
        chevron
        onPress={() => router.push('/practice/strategies')}
      />
      {prefs.strategies.length > 0 ? (
        <TimeField label={t('practice.notifyPrefs.time')} value={prefs.strategyTime} onChange={(time) => setPrefs((p) => ({ ...p, strategyTime: time }))} />
      ) : null}
      {denied ? <Notice tone="destructive">{t('practice.permissionDenied')}</Notice> : null}
    </SettingsGroup>
  );
}

/** «نية اليوم والمحاسبة»: device-local switches (practice-core `HeartPrefs`), and «التزام شخصي» with its pledges. */
export function HeartSection() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const set = (patch: Partial<HeartPrefs>) => setHeart((h) => setHeartPrefs(h, patch));
  const sw = (label: string, key: keyof HeartPrefs, hint?: string) => (
    <View style={styles.switchRow}>
      <SwitchRow label={label} hint={hint} value={heart.prefs[key]} onValueChange={(v) => set({ [key]: v })} />
    </View>
  );
  return (
    <SettingsGroup title={t('practice.notifyPrefs.heartTitle')}>
      {sw(t('practice.notifyPrefs.intention'), 'intention')}
      {sw(t('practice.notifyPrefs.eveningReview'), 'eveningReview')}
      {sw(t('practice.notifyPrefs.fridayReview'), 'fridayReview')}
      {sw(t('practice.notifyPrefs.pledges'), 'pledges', t('practice.notifyPrefs.pledgesHint'))}
      {heart.prefs.pledges ? (
        <ListRow
          icon={HandHeart}
          title={t('practice.notifyPrefs.pledges')}
          value={String(heart.pledges.length)}
          chevron
          onPress={() => router.push('/practice/pledges')}
        />
      ) : null}
    </SettingsGroup>
  );
}

/** Theme (device, light, dark) and language, each a segmented choice like the site's; «إظهار التاريخ الهجري»; «نص اليوم». */
export function AppearanceSection() {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const themePref = useThemePreference((s) => s.pref);
  const setThemePref = useThemePreference((s) => s.setPref);
  const currentLocale: SupportedLocale = i18n.language === 'en' ? 'en' : 'ar';
  const showHijri = usePracticeStore((s) => s.prefs.showHijri);
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
      <SwitchRow
        label={t('settings.showHijri')}
        value={showHijri}
        onValueChange={(on) => setPrefs((p) => ({ ...p, showHijri: on }))}
      />
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
