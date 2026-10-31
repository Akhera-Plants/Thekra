/**
 * The sections of Settings after its account and appearance parts: a titled group of hairline rows
 * (`SettingsGroup`), «الخصوصية» (the sin-program lock, the encrypted backup, export, the sin-program wipe, the
 * offline copy), «التذكيرات» (what this device has scheduled and each track's switch) and «عن التطبيق».
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
  Check,
  Database,
  Download,
  ExternalLink,
  FileText,
  HeartHandshake,
  Info,
  KeyRound,
  ShieldCheck,
  Sprout,
  Trash2,
} from 'lucide-react-native';
import { exportAccountData } from '@/lib/api/practice';
import { scheduledReminderCount } from '@/lib/practice/notifications';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { unlockWithDevice, useDeviceLockAvailable } from '@/lib/practice/use-sin-privacy';
import { wipeSinProgramEverywhere } from '@/lib/practice/vault-runner';
import { SITE_ABOUT_PATH, SITE_PRIVACY_PATH, sitePageUrl } from '@/lib/site';
import { useAuthStore } from '@/lib/stores/auth-store';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import { ErrorText, Icon, ListRow, Notice, SwitchRow, Text } from '@/ui';

const QUERY_CACHE_KEY = 'thekra_query_cache';

const makeStyles = (t: Theme) => ({
  group: { gap: space.sm },
  head: { gap: 2 },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  switchRow: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
});

export function SettingsGroup({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.group}>
      <View style={styles.head}>
        <Text variant="eyebrow" accessibilityRole="header">
          {title}
        </Text>
        {lead ? (
          <Text variant="caption" tone="muted">
            {lead}
          </Text>
        ) : null}
      </View>
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
  const hasProgramData = usePracticeStore((s) => s.store.programs.length > 0);
  const lockAvailable = useDeviceLockAvailable();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [wiped, setWiped] = useState(false);

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

  function handleWipe() {
    Alert.alert(t('settings.wipeSin'), t('sinProgram.wipeHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.wipeSinConfirm'),
        style: 'destructive',
        onPress: () => {
          setWiped(true);
          void wipeSinProgramEverywhere(userId);
        },
      },
    ]);
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
    <SettingsGroup title={t('settings.privacy')}>
      {lockAvailable || lockOn ? (
        <View style={styles.switchRow}>
          <SwitchRow
            label={t('sinLock.switch')}
            hint={t('sinLock.switchHint')}
            value={lockOn}
            onValueChange={(on) => void handleLockChange(on)}
          />
        </View>
      ) : null}
      <ListRow
        icon={KeyRound}
        title={t('vault.title')}
        hint={t('settings.vaultHint')}
        chevron
        onPress={() => router.push('/practice/sin-program')}
      />
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
      {hasProgramData ? <ListRow icon={Trash2} title={t('settings.wipeSin')} destructive onPress={handleWipe} /> : null}
      {wiped && !hasProgramData ? <Notice icon={Check}>{t('sinProgram.wiped')}</Notice> : null}
      <ListRow icon={Database} title={t('settings.clearCache')} hint={t('settings.clearCacheHint')} chevron onPress={handleClearCache} />
    </SettingsGroup>
  );
}

/** What this device will remind of: the scheduled count (re-read on every visit) and each track's switch. */
export function RemindersSection() {
  const { t } = useTranslation();
  const prefs = usePracticeStore((s) => s.prefs);
  const [count, setCount] = useState<number | null>(null);

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

  const state = (on: boolean) => (on ? t('settings.on') : t('settings.off'));

  return (
    <SettingsGroup title={t('settings.reminders')} lead={count === null ? undefined : t('settings.remindersCount', { count })}>
      <ListRow
        icon={Sprout}
        title={t('practice.hub.habitsTrack')}
        value={state(prefs.habitReminders)}
        chevron
        onPress={() => router.push('/practice/habits')}
      />
      <ListRow
        icon={HeartHandshake}
        title={t('kinship.title')}
        value={state(prefs.kinshipReminders)}
        chevron
        onPress={() => router.push('/practice/kinship')}
      />
      <ListRow
        icon={ShieldCheck}
        title={t('sinProgram.title')}
        value={state(prefs.sinReminders)}
        chevron
        onPress={() => router.push('/practice/sin-program')}
      />
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
    <SettingsGroup title={t('settings.about')}>
      <ListRow icon={BookOpen} title={t('settings.aboutThekra')} onPress={openSite(SITE_ABOUT_PATH)} trailing={external} />
      <ListRow icon={FileText} title={t('settings.privacyPolicy')} onPress={openSite(SITE_PRIVACY_PATH)} trailing={external} />
      <ListRow icon={Info} title={t('settings.version')} value={version} />
    </SettingsGroup>
  );
}
