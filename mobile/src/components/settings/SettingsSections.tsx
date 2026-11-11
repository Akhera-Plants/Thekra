/**
 * The contents of the Settings group screens (app/settings/*): a titled group of hairline rows (`SettingsGroup`),
 * «الخصوصية والتشفير» (where «تخفَّف» is kept: always encrypted in the account; «إخفاء برامج التخفّف» in «العادات»; export,
 * the offline copy), «اللغة والمظهر» (theme, language, the Hijri date, the Quran reciter with a one-ayah preview, and
 * «خصّص الرئيسية», round 6 C-04: only here, never on the home page). «عن ذكرى» is its own page (app/settings/about.tsx). «التنبيهات» has its own component (NotificationsSettings.tsx). No «delete all data» here (owner, 2026-11-01): «تخفَّف» keeps its own one-tap wipe, and the account
 * deletion stays under «الحساب».
 */

import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { Database, Download, LayoutList, Mic } from 'lucide-react-native';
import { RECITERS, chosenReciter, isLightenCovered, setLightenCovered, setReciter } from '@thekra/practice-core';
import { exportAccountData } from '@/lib/api/practice';
import { shareExportFile } from '@/lib/export-file';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { switchDirectionIfNeeded, type SupportedLocale } from '@/lib/i18n';
import { setApiLocale } from '@/lib/api-client';
import { space, useStyles, useTheme, useThemePreference, type Theme, type ThemePreference } from '@/theme';
import { VaultSignInNote, VaultStatusCard } from '@/components/practice/VaultCard';
import { HomeEditSheet } from '@/components/home/HomeSections';
import { VerseAudioButton } from '@/components/VerseAudioButton';
import { BottomSheet, CheckRow, ErrorText, ListRow, SegmentTabs, SwitchRow, Text, confirm, toast, type SegmentItem } from '@/ui';

/** The ayah every reciter is previewed with (al-Fatiha 1:2), read from the reciter's own files. */
const PREVIEW_AYAH = { surah: 1, ayah: 2 } as const;

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
  reciterRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs },
  reciterPick: { flex: 1, minWidth: 0 },
  reciters: { gap: space.sm },
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
      if (!(await shareExportFile(data, t('settings.exportData')))) setExportError(true);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  function handleClearCache() {
    void confirm({
      title: t('settings.clearCache'),
      message: t('settings.clearCacheConfirm'),
      confirmLabel: t('settings.clearCacheAction'),
      tone: 'destructive',
      icon: Database,
    }).then(async (ok) => {
      if (!ok) return;
      qc.clear();
      await AsyncStorage.removeItem(QUERY_CACHE_KEY);
    });
  }

  return (
    <>
      {/* «تخفَّف» is always kept encrypted in the account and opened with the fingerprint: one status line here. */}
      {userId ? <VaultStatusCard /> : <VaultSignInNote />}
      {userId ? <LightenCoverRow /> : null}
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
 * Theme (device, light, dark) and language, each a segmented choice like the site's, «إظهار التاريخ الهجري», «القارئ»
 * and (members) «خصّص الرئيسية» (round 6, C-04). «نص اليوم» is gone (C-01q).
 */
export function AppearanceSection() {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const themePref = useThemePreference((s) => s.pref);
  const setThemePref = useThemePreference((s) => s.setPref);
  const currentLocale: SupportedLocale = i18n.language === 'en' ? 'en' : 'ar';
  const showHijri = usePracticeStore((s) => s.prefs.showHijri);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const member = useAuthStore((s) => s.user !== null);
  const [editingHome, setEditingHome] = useState(false);

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
      <ReciterRow />
      {member ? (
        <>
          <ListRow icon={LayoutList} title={t('homeSections.edit.title')} hint={t('homeSections.edit.lead')} chevron last onPress={() => setEditingHome(true)} />
          <HomeEditSheet visible={editingHome} onClose={() => setEditingHome(false)} />
        </>
      ) : null}
    </SettingsGroup>
  );
}

/**
 * «القارئ» (round 6 §8 «Audio»): the reciter of every verse card, chosen from practice-core `RECITERS` (synced with the
 * settings record). Each row previews one ayah in that reciter; choosing saves at once with a toast.
 */
function ReciterRow() {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const english = i18n.language === 'en';
  const reciter = usePracticeStore((s) => chosenReciter(s.store));
  const setStore = usePracticeStore((s) => s.setStore);
  const [open, setOpen] = useState(false);

  function choose(key: string) {
    if (key !== reciter.key) {
      setStore((s) => setReciter(s, key));
      toast(t('settings.reciter.saved'));
    }
    setOpen(false);
  }

  return (
    <>
      <ListRow icon={Mic} title={t('settings.reciter.title')} value={english ? reciter.en : reciter.ar} chevron onPress={() => setOpen(true)} />
      <BottomSheet visible={open} title={t('settings.reciter.title')} onClose={() => setOpen(false)}>
        <Text variant="small" tone="muted">
          {t('settings.reciter.lead')}
        </Text>
        <View style={styles.reciters} accessibilityRole="radiogroup">
          {RECITERS.map((r) => (
            <View key={r.key} style={styles.reciterRow}>
              <View style={styles.reciterPick}>
                <CheckRow radio title={english ? r.en : r.ar} checked={r.key === reciter.key} onPress={() => choose(r.key)} />
              </View>
              <VerseAudioButton surah={PREVIEW_AYAH.surah} ayah={PREVIEW_AYAH.ayah} previewReciter={r.key} />
            </View>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

/**
 * «إخفاء برامج التخفّف» (round 6 §2, C-02e): «تخفَّف» programs show in «العادات» as covered rows by default (the device
 * lock or the privacy code opens them). Turning this off shows them uncovered; the encryption does not change.
 */
function LightenCoverRow() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const covered = usePracticeStore((s) => isLightenCovered(s.store));
  const setStore = usePracticeStore((s) => s.setStore);
  return (
    <View style={[styles.switchRow, styles.last]}>
      <SwitchRow
        label={t('settings.lightenCovered.label')}
        hint={t('settings.lightenCovered.hint')}
        value={covered}
        onValueChange={(on) => {
          setStore((s) => setLightenCovered(s, on));
          toast(t('settings.lightenCovered.saved'));
        }}
      />
    </View>
  );
}
