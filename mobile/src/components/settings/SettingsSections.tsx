/**
 * The sections of Settings after its account and appearance parts: a titled group of hairline rows
 * (`SettingsGroup`), «الخصوصية» (the sin-program lock, the encrypted backup, export, the sin-program wipe, the
 * offline copy), «التنبيهات» (every reminder switch and time, the only place for them), «نية اليوم والمحاسبة» and
 * «عن التطبيق».
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
  HandHeart,
  Info,
  KeyRound,
  NotebookPen,
  Trash2,
} from 'lucide-react-native';
import { setHeartPrefs, type HeartPrefs } from '@thekra/practice-core';
import { TimeField } from '@/components/practice/editors';
import { exportAccountData } from '@/lib/api/practice';
import { ensurePermission, scheduledReminderCount } from '@/lib/practice/notifications';
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
      title={t('practice.notifyPrefs.title')}
      lead={count === null ? t('practice.notifyPrefs.lead') : `${t('practice.notifyPrefs.lead')} ${t('settings.remindersCount', { count })}`}
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
      <ListRow icon={NotebookPen} title={t('record.reviews')} hint={t('record.reviewsHint')} chevron onPress={() => router.push('/practice/reviews')} />
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
