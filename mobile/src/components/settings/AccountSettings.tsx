/**
 * Settings ← «الحساب»: who is signed in and the practice sync (or the guest note with the way in), then signing out
 * (a plain row), and at the bottom, apart under its own «منطقة الحذف» header, «حذف الحساب» as a bordered destructive
 * button (password → DELETE /v1/auth/me → local sign-out; the practice data on this device is kept; store
 * policy requires it in the app).
 */

import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, LogOut, RefreshCw, Trash2 } from 'lucide-react-native';
import { useAuthStore } from '@/lib/stores/auth-store';
import { deleteAccount } from '@/lib/api/practice';
import { syncPractice, useSyncStatus } from '@/lib/practice/sync-runner';
import { nowTime } from '@/lib/practice/format';
import { queryKeys } from '@/lib/query-keys';
import { ApiError } from '@/lib/types/api';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, Field, ListRow, Notice, Text, SectionDivider, ButtonPair, ProfileMark, confirm } from '@/ui';
import { SettingsGroup } from './SettingsSections';

const makeStyles = (t: Theme) => ({
  guest: { gap: space.md, paddingVertical: space.lg },
  danger: { gap: space.md, marginTop: space['2xl'] },
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

export function AccountSettings() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
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

  async function handleLogout() {
    const ok = await confirm({ title: t('settings.signOutTitle'), confirmLabel: t('settings.signOut'), tone: 'destructive', icon: LogOut });
    if (ok) await logout();
  }

  function openDelete() {
    setDeleteError(null);
    setPassword('');
    setDeleteOpen(true);
  }

  return (
    <>
      <AccountSection accountDeleted={accountDeleted} />

      {user ? (
        <SettingsGroup title={t('settings.signOutGroup')}>
          <ListRow icon={LogOut} title={t('settings.signOut')} onPress={() => void handleLogout()} />
        </SettingsGroup>
      ) : null}

      {user ? (
        <View style={styles.danger}>
          <SectionDivider />
          <Text variant="eyebrow" tone="destructive" accessibilityRole="header">
            {t('settings.dangerZone')}
          </Text>
          <Button label={t('settings.deleteAccount')} icon={Trash2} variant="destructive" onPress={openDelete} />
        </View>
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
    </>
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
    <SettingsGroup lead={user ? t('settings.syncNote') : undefined}>
      {accountDeleted && !user ? <Notice icon={CircleCheck}>{t('settings.deleted')}</Notice> : null}
      {user ? (
        <>
          <ListRow leading={<ProfileMark size={28} />} title={user.email} ltrTitle hint={t('settings.signedIn')} />
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
            <ButtonPair
              primary={{ label: t('settings.deleteConfirm'), variant: 'destructive', loading: deleting, disabled: !password, onPress: onConfirm }}
              secondary={{ label: t('common.cancel'), onPress: onClose }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
