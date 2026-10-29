/**
 * Settings, after the website's settings page: grouped sections separated by hairlines, not a card per row.
 * Language (a direction change reloads the app at once), appearance (device, light, dark), account, practice data,
 * then the destructive actions last in the destructive tone.
 * Signed in: practice sync now, «تصدير بياناتي» (GET /v1/auth/me/export shared as JSON) and «حذف الحساب»
 * (password → DELETE /v1/auth/me → local sign-out; the practice data on this device is kept).
 */

import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Check, CircleCheck } from 'lucide-react-native';
import { useAuthStore } from '@/lib/stores/auth-store';
import { switchDirectionIfNeeded, type SupportedLocale } from '@/lib/i18n';
import { setApiLocale } from '@/lib/api-client';
import { deleteAccount, exportAccountData } from '@/lib/api/practice';
import { syncPractice, useSyncStatus } from '@/lib/practice/sync-runner';
import { nowTime } from '@/lib/practice/format';
import { queryKeys } from '@/lib/query-keys';
import { ApiError } from '@/lib/types/api';
import { radius, space, useStyles, useTheme, useThemePreference, type Theme, type ThemePreference } from '@/theme';
import { Button, ErrorText, Field, Icon, Notice, PageHeader, Screen, SwitchRow, Text } from '@/ui';

const LOCALE_STORAGE_KEY = 'thekra_locale';

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

const makeStyles = (t: Theme) => ({
  group: { gap: space.sm },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  rowText: { flex: 1, gap: 2 },
  switchRow: { paddingVertical: space.xs },
  pressed: { backgroundColor: t.colors.accent },
  disabled: { opacity: 0.45 },
  guest: { gap: space.md, paddingTop: space.md },
  backdrop: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'center' as const, padding: space.xl },
  dialog: {
    backgroundColor: t.colors.card,
    borderColor: t.colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.xl,
    gap: space.md,
  },
  dialogActions: { gap: space.sm, marginTop: space.xs },
});

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearSession = useAuthStore((s) => s.clearSession);
  const qc = useQueryClient();
  const styles = useStyles(makeStyles);
  const themePref = useThemePreference((s) => s.pref);
  const setThemePref = useThemePreference((s) => s.setPref);

  const [showTranslations, setShowTranslations] = useState(false);
  const syncStatus = useSyncStatus((s) => s.status);
  const lastOkAt = useSyncStatus((s) => s.lastOkAt);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleSyncNow() {
    if (!user) return;
    await syncPractice(user.id);
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

  async function handleDeleteAccount() {
    if (!password) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(password);
      // Signed-out locally; the account's synced copies in the cache go, this device's practice data stays.
      await clearSession();
      qc.removeQueries({ queryKey: queryKeys.favorites.all });
      setDeleteOpen(false);
      setPassword('');
      setAccountDeleted(true);
    } catch (e) {
      const wrong = e instanceof ApiError && (e.status === 401 || e.status === 403);
      setDeleteError(wrong ? t('settings.wrongPassword') : t('settings.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  const currentLocale = (i18n.language as SupportedLocale) ?? 'ar';

  async function changeLocale(locale: SupportedLocale) {
    if (locale === currentLocale) return;
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
    // A direction change reloads the app now; the start-up reads the saved locale.
    if (await switchDirectionIfNeeded(locale)) return;
    await i18n.changeLanguage(locale);
    setApiLocale(locale);
  }

  function handleLogout() {
    Alert.alert(t('settings.signOut'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
        style: 'destructive',
        onPress: async () => {
          await logout();
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
          await AsyncStorage.removeItem('thekra_query_cache');
        },
      },
    ]);
  }

  function openDelete() {
    setDeleteError(null);
    setPassword('');
    setDeleteOpen(true);
  }

  const syncHint =
    syncStatus === 'idle' || syncStatus === 'running'
      ? undefined
      : `${t(syncStatus === 'ok' ? 'settings.syncOk' : syncStatus === 'offline' ? 'settings.syncOffline' : 'settings.syncError')}${
          lastOkAt ? ` · ${t('settings.syncLast', { time: nowTime(new Date(lastOkAt)) })}` : ''
        }`;

  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <Screen>
      <PageHeader title={t('settings.title')} />

      <Group title={t('settings.language')}>
        <OptionRow label={t('settings.languageAr')} selected={currentLocale === 'ar'} onPress={() => void changeLocale('ar')} />
        <OptionRow label={t('settings.languageEn')} selected={currentLocale === 'en'} onPress={() => void changeLocale('en')} />
        <HairlineSwitch label={t('settings.translations')} value={showTranslations} onValueChange={setShowTranslations} />
      </Group>

      <Group title={t('theme.title')}>
        {THEME_OPTIONS.map((option) => (
          <OptionRow key={option} label={t(`theme.${option}`)} selected={themePref === option} onPress={() => setThemePref(option)} />
        ))}
      </Group>

      <Group title={t('settings.account')}>
        {accountDeleted && !user ? <Notice icon={CircleCheck}>{t('settings.deleted')}</Notice> : null}
        {user ? (
          <ActionRow label={user.email} />
        ) : (
          <View style={styles.guest}>
            <Text variant="small" tone="muted">
              {t('auth.guestNote')}
            </Text>
            <Button label={t('settings.signIn')} onPress={() => router.push('/(auth)/login')} arrow />
          </View>
        )}
      </Group>

      {user ? (
        <Group title={t('settings.practice')}>
          <Text variant="small" tone="muted">
            {t('settings.syncNote')}
          </Text>
          <ActionRow
            label={t('settings.syncNow')}
            tone="link"
            hint={syncHint}
            busy={syncStatus === 'running'}
            onPress={() => void handleSyncNow()}
          />
          <ActionRow label={t('settings.exportData')} tone="link" busy={exporting} onPress={() => void handleExport()} />
          {exportError ? <ErrorText>{t('settings.exportFailed')}</ErrorText> : null}
        </Group>
      ) : null}

      <Group>
        <ActionRow label={t('settings.clearCache')} onPress={handleClearCache} />
        {user ? <ActionRow label={t('settings.signOut')} tone="destructive" onPress={handleLogout} /> : null}
        {user ? <ActionRow label={t('settings.deleteAccount')} tone="destructive" onPress={openDelete} /> : null}
      </Group>

      <Text variant="caption" tone="muted">
        {`${t('settings.version')} ${version}`}
      </Text>

      <DeleteAccountDialog
        visible={deleteOpen}
        password={password}
        onPasswordChange={setPassword}
        error={deleteError}
        deleting={deleting}
        onConfirm={() => void handleDeleteAccount()}
        onClose={() => setDeleteOpen(false)}
      />
    </Screen>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.group}>
      {title ? (
        <Text variant="small" weight="medium" tone="muted" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.list}>{children}</View>
    </View>
  );
}

/** One choice of a set (language, appearance): the label and a check at the end when chosen. */
function OptionRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <Text variant="body" weight={selected ? 'medium' : 'regular'} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {selected ? <Icon icon={Check} size={20} tone="link" strokeWidth={1.8} /> : null}
    </Pressable>
  );
}

/** A plain row: an action when `onPress` is given, otherwise a line of information. */
function ActionRow({
  label,
  hint,
  tone = 'default',
  busy,
  onPress,
}: {
  label: string;
  hint?: string;
  tone?: 'default' | 'link' | 'destructive';
  busy?: boolean;
  onPress?: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const text = (
    <View style={styles.rowText}>
      <Text variant="body" tone={tone} weight={onPress ? 'medium' : 'regular'} numberOfLines={1} ellipsizeMode="middle">
        {label}
      </Text>
      {hint ? (
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) return <View style={styles.row}>{text}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(busy), busy: Boolean(busy) }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, busy && styles.disabled]}
    >
      {text}
      {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
    </Pressable>
  );
}

function HairlineSwitch(props: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.row, styles.switchRow]}>
      <View style={styles.rowText}>
        <SwitchRow {...props} />
      </View>
    </View>
  );
}

interface DeleteAccountDialogProps {
  visible: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string | null;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Password confirmation for deleting the account. */
function DeleteAccountDialog({ visible, password, onPasswordChange, error, deleting, onConfirm, onClose }: DeleteAccountDialogProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text variant="heading" accessibilityRole="header">
            {t('settings.deleteAccount')}
          </Text>
          <Text variant="small" tone="muted">
            {t('settings.deleteAccountBody')}
          </Text>
          <Field
            label={t('settings.passwordPlaceholder')}
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            error={error}
          />
          <View style={styles.dialogActions}>
            <Button
              label={t('settings.deleteConfirm')}
              variant="destructive"
              block
              loading={deleting}
              disabled={!password}
              onPress={onConfirm}
            />
            <Button label={t('common.cancel')} variant="ghost" block onPress={onClose} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
