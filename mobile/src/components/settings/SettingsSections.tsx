/**
 * The contents of the Settings group screens (app/settings/*): a titled group of hairline rows (`SettingsGroup`),
 * «الخصوصية والتشفير» (where «تخفَّف» is kept: always encrypted in the account; export, the offline copy),
 * «اللغة والمظهر» and «عن ذكرى». «التنبيهات» has its own component (NotificationsSettings.tsx). No «delete all data» here (owner, 2026-11-01): «تخفَّف» keeps its own one-tap wipe, and the account
 * deletion stays under «الحساب».
 */

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { BookOpen, Database, Download, ExternalLink, FileText, Info } from 'lucide-react-native';
import { exportAccountData } from '@/lib/api/practice';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { SITE_ABOUT_PATH, SITE_PRIVACY_PATH, sitePageUrl } from '@/lib/site';
import { useAuthStore } from '@/lib/stores/auth-store';
import { switchDirectionIfNeeded, type SupportedLocale } from '@/lib/i18n';
import { setApiLocale } from '@/lib/api-client';
import { space, useStyles, useTheme, useThemePreference, type Theme, type ThemePreference } from '@/theme';
import { VaultSignInNote, VaultStatusCard } from '@/components/practice/VaultCard';
import { ErrorText, Icon, ListRow, SegmentTabs, SwitchRow, Text, type SegmentItem } from '@/ui';

const QUERY_CACHE_KEY = 'thekra_query_cache';
const LOCALE_STORAGE_KEY = 'thekra_locale';
const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

const makeStyles = (t: Theme) => ({
  group: { gap: space.sm },
  head: { gap: 2 },
  /** No top rule: the first row sits under its section title (A-05). */
  list: {},
  switchRow: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  last: { borderBottomWidth: 0 },
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
 * Theme (device, light, dark) and language, each a segmented choice like the site's, and «إظهار التاريخ الهجري».
 * Round 5: «شعبة الأسبوع» moved to the home sections and the branches page (F-18 a), «نص اليوم» to the home section's
 * «⋯» (F-23 a).
 */
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
      <View style={[styles.switchRow, styles.last]}>
        <SwitchRow
          label={t('settings.showHijri')}
          value={showHijri}
          onValueChange={(on) => setPrefs((p) => ({ ...p, showHijri: on }))}
        />
      </View>
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
