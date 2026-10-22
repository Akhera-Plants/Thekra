/**
 * Settings tab — language toggle (with RTL), theme, account, offline cache.
 * mobile-plan §3 (Settings screen), §4 (RTL).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
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

const LOCALE_STORAGE_KEY = 'thekra_locale';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();

  const [showTranslations, setShowTranslations] = useState(false);

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

        {/* Content */}
        <Section title={t('common.ok')}>
          <Row label={t('settings.translations')}>
            <Switch
              value={showTranslations}
              onValueChange={setShowTranslations}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.textInverse}
            />
          </Row>
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
