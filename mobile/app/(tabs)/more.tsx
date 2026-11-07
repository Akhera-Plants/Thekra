/**
 * «المزيد» (owner round 5, §1 IA): every screen that is not a tab, as hairline rows in three short groups (src/lib/nav/
 * more-menu.ts `MORE_MENU`): «تخفَّف», «أهلي وناسي», «رفقة», «المحفوظات»; then the reading pages («تصفّح النصوص», «شعب
 * الإيمان», «استراتيجيات العادات»); then «الإعدادات» (الحساب، الخصوصية، التنبيهات، أوقات الصلاة، اللغة والمظهر، عن ذكرى).
 * The groups are divided by the flower divider. A members-only row asks a guest to sign in first. Rows show their
 * current value where there is one (the account e-mail, the city, the language).
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Bookmark,
  BookOpen,
  Clock,
  DoorOpen,
  HeartHandshake,
  Info,
  Languages,
  Library,
  Lightbulb,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { isSignedIn, openSignIn } from '@/lib/auth/require-sign-in';
import { MORE_MENU, moreAction, type MoreItem, type MoreKey } from '@/lib/nav/more-menu';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { AppHeader } from '@/components/nav/AppHeader';
import { space, useStyles, type Theme } from '@/theme';
import { ListRow, PageHeader, Screen, SectionDivider, SectionHeader } from '@/ui';

const ICONS: Record<MoreKey, LucideIcon> = {
  'leave-sin': DoorOpen,
  people: HeartHandshake,
  circles: Users,
  saved: Bookmark,
  browse: Library,
  branches: BookOpen,
  strategies: Lightbulb,
  account: UserRound,
  privacy: ShieldCheck,
  notifications: Bell,
  'prayer-times': Clock,
  appearance: Languages,
  about: Info,
};

const makeStyles = (_t: Theme) => ({
  group: { gap: space.xs },
});

export default function MoreScreen() {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const email = useAuthStore((s) => s.user?.email ?? null);
  const city = usePracticeStore((s) => s.prefs.prayer?.city ?? null);

  const values: Partial<Record<MoreKey, string>> = {
    account: email ?? t('settings.signIn'),
    'prayer-times': city ?? t('prayerTimes.notSet'),
    appearance: i18n.language === 'en' ? t('settings.languageEn') : t('settings.languageAr'),
  };

  function open(entry: MoreItem) {
    const action = moreAction(entry, isSignedIn());
    if (action.kind === 'signIn') openSignIn(action.next);
    else router.push(action.href);
  }

  return (
    <Screen>
      <AppHeader />
      <PageHeader title={t('tabs.more')} />
      {MORE_MENU.map((group, gi) => (
        <React.Fragment key={group.key}>
          {gi > 0 ? <SectionDivider /> : null}
          <View style={styles.group}>
            {group.key === 'mine' ? null : <SectionHeader title={t(group.titleKey)} size="heading" />}
            <View>
              {group.items.map((entry, i) => (
                <ListRow
                  key={entry.key}
                  icon={ICONS[entry.key]}
                  title={t(entry.labelKey)}
                  value={values[entry.key]}
                  chevron
                  last={i === group.items.length - 1}
                  onPress={() => open(entry)}
                />
              ))}
            </View>
          </View>
        </React.Fragment>
      ))}
    </Screen>
  );
}
