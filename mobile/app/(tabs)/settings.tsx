/**
 * Settings as a short list of groups (owner, 2026-11-01: «categorize, don't make one long scroll»): «الحساب»,
 * «التنبيهات والتذكير», «أوقات الصلاة», «الخصوصية والتشفير», «اللغة والمظهر» and «عن التطبيق» (`SETTINGS_GROUPS`).
 * Each row opens its own screen (app/settings/*, prayer times in practice/); a members-only group asks a guest to sign
 * in first. Each row shows its current value where there is one (the account e-mail, the language, the city).
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bell, Clock, Info, Languages, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react-native';
import { isSignedIn, openSignIn } from '@/lib/auth/require-sign-in';
import { SETTINGS_GROUPS, type SettingsGroupEntry, type SettingsGroupKey } from '@/lib/settings/groups';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { AppHeader } from '@/components/nav/AppHeader';
import { space, useStyles, type Theme } from '@/theme';
import { ListRow, PageHeader, Screen } from '@/ui';

const ICONS: Record<SettingsGroupKey, LucideIcon> = {
  account: UserRound,
  notifications: Bell,
  prayer: Clock,
  privacy: ShieldCheck,
  appearance: Languages,
  about: Info,
};

const makeStyles = (_t: Theme) => ({
  /** No top rule: the first row sits under its section title (A-05). */
  list: { marginTop: -space.sm },
});

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const email = useAuthStore((s) => s.user?.email ?? null);
  const city = usePracticeStore((s) => s.prefs.prayer?.city ?? null);

  const values: Partial<Record<SettingsGroupKey, string>> = {
    account: email ?? t('settings.signIn'),
    prayer: city ?? t('prayerTimes.notSet'),
    appearance: i18n.language === 'en' ? t('settings.languageEn') : t('settings.languageAr'),
  };

  function open(group: SettingsGroupEntry) {
    if (group.members && !isSignedIn()) openSignIn(typeof group.href === 'string' ? group.href : '/settings');
    else router.push(group.href);
  }

  return (
    <Screen>
      <AppHeader />
      <PageHeader title={t('settings.title')} />
      <View style={styles.list}>
        {SETTINGS_GROUPS.map((group) => (
          <ListRow
            key={group.key}
            icon={ICONS[group.key]}
            title={t(group.titleKey)}
            value={values[group.key]}
            chevron
            onPress={() => open(group)}
          />
        ))}
      </View>
    </Screen>
  );
}
