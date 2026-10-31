/**
 * Settings tab — language toggle (with RTL), theme, account, offline cache.
 * mobile-plan §3 (Settings screen), §4 (RTL).
 * Signed in: practice sync now, «تصدير بياناتي» (GET /v1/auth/me/export shared as JSON) and «حذف الحساب»
 * (password → DELETE /v1/auth/me → local sign-out; the practice data on this device is kept).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
  Share,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { applyRtlIfNeeded, type SupportedLocale } from '@/lib/i18n';
import { setApiLocale } from '@/lib/api-client';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';
import Constants from 'expo-constants';
import { deleteAccount, exportAccountData } from '@/lib/api/practice';
import { syncPractice, useSyncStatus } from '@/lib/practice/sync-runner';
import { nowTime } from '@/lib/practice/format';
import { queryKeys } from '@/lib/query-keys';
import { ApiError } from '@/lib/types/api';

const LOCALE_STORAGE_KEY = 'thekra_locale';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearSession = useAuthStore((s) => s.clearSession);
  const qc = useQueryClient();

  const syncStatus = useSyncStatus((s) => s.status);
  const lastOkAt = useSyncStatus((s) => s.lastOkAt);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleSyncNow() {
    if (!user) return;
    await syncPractice(user.id);
  }

  async function handleExport() {
    try {
      const data = await exportAccountData();
      await Share.share({ message: JSON.stringify(data, null, 2) });
    } catch {
      Alert.alert(t('settings.exportFailed'));
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
      Alert.alert(t('settings.deleted'));
    } catch (e) {
      const wrong = e instanceof ApiError && (e.status === 401 || e.status === 403);
      setDeleteError(wrong ? t('settings.wrongPassword') : t('settings.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  const currentLocale = (i18n.language as SupportedLocale) ?? 'ar';

  async function changeLocale(locale: SupportedLocale) {
    await i18n.changeLanguage(locale);
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
    setApiLocale(locale);

    const directionChanged = applyRtlIfNeeded(locale);
    if (directionChanged) {
      Alert.alert(
        t('settings.languageRestart'),
        '',
        [{ text: t('common.ok') }],
      );
    }
  }

  async function handleLogout() {
    Alert.alert(
      t('settings.signOut'),
      '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.signOut'),
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ],
    );
  }

  async function handleClearCache() {
    Alert.alert(
      t('settings.clearCache'),
      t('settings.clearCacheConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.clearCache'),
          style: 'destructive',
          onPress: async () => {
            qc.clear();
            await AsyncStorage.removeItem('thekra_query_cache');
          },
        },
      ],
    );
  }

  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.title')}
        </Text>

        {/* Language */}
        <Section title={t('settings.language')}>
          <LanguageRow
            locale="ar"
            label={t('settings.languageAr')}
            currentLocale={currentLocale}
            onSelect={changeLocale}
          />
          <LanguageRow
            locale="en"
            label={t('settings.languageEn')}
            currentLocale={currentLocale}
            onSelect={changeLocale}
          />
        </Section>

        {/* Account */}
        <Section title={t('settings.account')}>
          {user ? (
            <>
              <Row label={user.email} />
              <TouchableOpacity
                style={styles.dangerBtn}
                onPress={() => void handleLogout()}
                accessibilityRole="button"
              >
                <Text style={styles.dangerBtnText}>{t('settings.signOut')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push('/(auth)/login')}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>{t('settings.signIn')}</Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* Practice data (signed in) */}
        {user ? (
          <Section title={t('settings.practice')}>
            <Row label={t('settings.syncNote')} />
            <TouchableOpacity
              style={styles.rowBtn}
              onPress={() => void handleSyncNow()}
              accessibilityRole="button"
              disabled={syncStatus === 'running'}
            >
              <Text style={styles.rowBtnText}>{t('settings.syncNow')}</Text>
              {syncStatus === 'running' ? (
                <ActivityIndicator color={Colors.primary} />
              ) : syncStatus !== 'idle' ? (
                <Text style={styles.statusText}>
                  {t(syncStatus === 'ok' ? 'settings.syncOk' : syncStatus === 'offline' ? 'settings.syncOffline' : 'settings.syncError')}
                  {lastOkAt ? ` · ${t('settings.syncLast', { time: nowTime(new Date(lastOkAt)) })}` : ''}
                </Text>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.rowBtn} onPress={() => void handleExport()} accessibilityRole="button">
              <Text style={styles.rowBtnText}>{t('settings.exportData')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rowBtn}
              onPress={() => {
                setDeleteError(null);
                setPassword('');
                setDeleteOpen(true);
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.rowBtnText, { color: Colors.error }]}>{t('settings.deleteAccount')}</Text>
            </TouchableOpacity>
          </Section>
        ) : null}

        {/* Offline cache */}
        <Section title="">
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => void handleClearCache()}
            accessibilityRole="button"
          >
            <Text style={styles.outlineBtnText}>{t('settings.clearCache')}</Text>
          </TouchableOpacity>
        </Section>

        {/* Version */}
        <Text style={styles.version}>
          {t('settings.version')} {version}
        </Text>
      </ScrollView>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('settings.deleteAccount')}</Text>
            <Text style={styles.modalBody}>{t('settings.deleteAccountBody')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('settings.passwordPlaceholder')}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              style={styles.modalInput}
              accessibilityLabel={t('settings.passwordPlaceholder')}
            />
            {deleteError ? <Text style={styles.modalError}>{deleteError}</Text> : null}
            <TouchableOpacity
              style={[styles.dangerBtn, (!password || deleting) && { opacity: 0.5 }]}
              onPress={() => void handleDeleteAccount()}
              disabled={!password || deleting}
              accessibilityRole="button"
            >
              {deleting ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <Text style={styles.dangerBtnText}>{t('settings.deleteConfirm')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => setDeleteOpen(false)} accessibilityRole="button">
              <Text style={styles.outlineBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      {title ? <Text style={sectionStyles.title}>{title}</Text> : null}
      <View style={sectionStyles.content}>{children}</View>
    </View>
  );
}

function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <View style={rowStyles.container}>
      <Text style={rowStyles.label}>{label}</Text>
      {children}
    </View>
  );
}

function LanguageRow({
  locale,
  label,
  currentLocale,
  onSelect,
}: {
  locale: SupportedLocale;
  label: string;
  currentLocale: SupportedLocale;
  onSelect: (l: SupportedLocale) => void;
}) {
  const isSelected = currentLocale === locale;
  return (
    <TouchableOpacity
      style={[rowStyles.container, isSelected && rowStyles.selected]}
      onPress={() => onSelect(locale)}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
    >
      <Text style={[rowStyles.label, isSelected && rowStyles.selectedLabel]}>
        {label}
      </Text>
      {isSelected && <Text style={{ color: Colors.primary }}>✓</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing['4'], gap: Spacing['4'] },
  title: { fontSize: FontSize['2xl'], fontWeight: '700', color: Colors.text },
  primaryBtn: {
    backgroundColor: Colors.primary,
    padding: Spacing['4'],
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.textInverse, fontWeight: '600', fontSize: FontSize.base },
  dangerBtn: {
    backgroundColor: Colors.error,
    padding: Spacing['4'],
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing['2'],
  },
  dangerBtnText: { color: Colors.textInverse, fontWeight: '600', fontSize: FontSize.base },
  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing['4'],
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  outlineBtnText: { color: Colors.textMuted, fontSize: FontSize.base },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing['4'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  rowBtnText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: '600' },
  statusText: { fontSize: FontSize.sm, color: Colors.textMuted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: Spacing['6'],
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing['6'],
    gap: Spacing['3'],
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  modalBody: { fontSize: FontSize.base, color: Colors.textMuted },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing['3'],
    fontSize: FontSize.base,
    color: Colors.text,
  },
  modalError: { fontSize: FontSize.sm, color: Colors.error },
  version: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: Spacing['4'],
  },
});

const sectionStyles = StyleSheet.create({
  container: { gap: Spacing['2'] },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'right',
    paddingHorizontal: Spacing['2'],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
});

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing['4'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  label: {
    fontSize: FontSize.base,
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  selected: {
    backgroundColor: Colors.primaryLight,
  },
  selectedLabel: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
