/**
 * Settings, crafted like the website's settings page: titled groups of hairline rows (kit `ListRow`: an icon, the
 * value on the end, a chevron), on the page decor. Order: «الحساب والمزامنة», «المظهر واللغة» (a direction change
 * reloads the app at once), «الخصوصية» (the sin-program lock, the encrypted backup, export, the wipe), «التذكيرات»,
 * «عن التطبيق» (the site's about and privacy pages), then signing out and deleting the account last.
 * Signed in: practice sync now, «تصدير بياناتي» (GET /v1/auth/me/export shared as JSON text: expo-file-system and
 * expo-sharing are not installed) and «حذف الحساب» (password → DELETE /v1/auth/me → local sign-out; the practice
 * data on this device is kept).
 */

import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, LogOut, RefreshCw, Trash2, UserRound } from 'lucide-react-native';
import { useAuthStore } from '@/lib/stores/auth-store';
import { switchDirectionIfNeeded, type SupportedLocale } from '@/lib/i18n';
import { setApiLocale } from '@/lib/api-client';
import { deleteAccount } from '@/lib/api/practice';
import { syncPractice, useSyncStatus } from '@/lib/practice/sync-runner';
import { nowTime } from '@/lib/practice/format';
import { queryKeys } from '@/lib/query-keys';
import { ApiError } from '@/lib/types/api';
import { AboutSection, PrivacySection, RemindersSection, SettingsGroup } from '@/components/settings/SettingsSections';
import { radius, space, useStyles, useTheme, useThemePreference, type Theme, type ThemePreference } from '@/theme';
import { Button, Field, ListRow, Notice, PageHeader, Screen, SegmentTabs, Text, type SegmentItem } from '@/ui';

const LOCALE_STORAGE_KEY = 'thekra_locale';

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

const makeStyles = (t: Theme) => ({
  guest: { gap: space.md, paddingVertical: space.lg },
  choice: { gap: space.sm, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border },
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
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearSession = useAuthStore((s) => s.clearSession);
  const qc = useQueryClient();
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  function openDelete() {
    setDeleteError(null);
    setPassword('');
    setDeleteOpen(true);
  }

  return (
    <Screen decor>
      <PageHeader title={t('settings.title')} />

      <AccountSection accountDeleted={accountDeleted} />
      <AppearanceSection />
      <PrivacySection />
      <RemindersSection />
      <AboutSection />

      {user ? (
        <SettingsGroup title={t('settings.signOutGroup')}>
          <ListRow icon={LogOut} title={t('settings.signOut')} destructive onPress={handleLogout} />
          <ListRow icon={Trash2} title={t('settings.deleteAccount')} destructive onPress={openDelete} />
        </SettingsGroup>
      ) : null}

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

/** Who is signed in and the practice sync, or the guest note with the way in. */
function AccountSection({ accountDeleted }: { accountDeleted: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const syncStatus = useSyncStatus((s) => s.status);
  const lastOkAt = useSyncStatus((s) => s.lastOkAt);
  const syncing = syncStatus === 'running';

  const syncHint =
    syncStatus === 'idle' || syncing
      ? undefined
      : `${t(syncStatus === 'ok' ? 'settings.syncOk' : syncStatus === 'offline' ? 'settings.syncOffline' : 'settings.syncError')}${
          lastOkAt ? ` · ${t('settings.syncLast', { time: nowTime(new Date(lastOkAt)) })}` : ''
        }`;

  return (
    <SettingsGroup title={t('settings.accountSync')} lead={user ? t('settings.syncNote') : undefined}>
      {accountDeleted && !user ? <Notice icon={CircleCheck}>{t('settings.deleted')}</Notice> : null}
      {user ? (
        <>
          <ListRow icon={UserRound} title={user.email} hint={t('settings.signedIn')} />
          <ListRow
            icon={RefreshCw}
            title={t('settings.syncNow')}
            hint={syncHint}
            chevron
            onPress={syncing ? undefined : () => void syncPractice(user.id)}
            trailing={syncing ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
          />
        </>
      ) : (
        <View style={styles.guest}>
          <Text variant="small" tone="muted">
            {t('auth.guestNote')}
          </Text>
          <Button label={t('settings.signIn')} onPress={() => router.push('/(auth)/login')} arrow />
        </View>
      )}
    </SettingsGroup>
  );
}

/** Theme (device, light, dark) and language, each a segmented choice like the site's. */
function AppearanceSection() {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const themePref = useThemePreference((s) => s.pref);
  const setThemePref = useThemePreference((s) => s.setPref);
  const currentLocale: SupportedLocale = i18n.language === 'en' ? 'en' : 'ar';

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
    <SettingsGroup title={t('settings.appearance')}>
      <View style={styles.choice}>
        <Text variant="label">{t('theme.title')}</Text>
        <SegmentTabs items={themeItems} value={themePref} onChange={setThemePref} />
      </View>
      <View style={styles.choice}>
        <Text variant="label">{t('settings.language')}</Text>
        <SegmentTabs items={localeItems} value={currentLocale} onChange={(locale) => void changeLocale(locale)} />
      </View>
    </SettingsGroup>
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
