/**
 * «المزيد» (round 6 §1; src/lib/nav/more-menu.ts `MORE_MENU`, from practice-core `APP_MORE`): «لك» (استراتيجيات
 * العادات، المحفوظات، رفقة، الحديقة), then «الإعدادات» (الحساب، الخصوصية والتشفير، التنبيهات، أوقات الصلاة، اللغة
 * والمظهر، عن ذكرى). No «تصفّح النصوص» and no people page. On a phone the two groups stack under the flower divider; on
 * a wide screen they sit side by side (the reference's two columns, C-03a). A members-only row asks a guest to sign in
 * first. Rows show their current value where there is one (the account e-mail, the city in the UI language, the
 * language).
 */

import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bell, Bookmark, Clock, Flower2, Info, Languages, Lightbulb, ShieldCheck, UserRound, Users, type LucideIcon } from 'lucide-react-native';
import { isSignedIn, openSignIn } from '@/lib/auth/require-sign-in';
import { MORE_MENU, moreAction, type MoreItem, type MoreKey } from '@/lib/nav/more-menu';
import { cityLabel } from '@/lib/practice/city-name';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { AppHeader } from '@/components/nav/AppHeader';
import { space, useStyles, type Theme } from '@/theme';
import { ListRow, PageHeader, Screen, SectionDivider, SectionHeader } from '@/ui';

const ICONS: Record<MoreKey, LucideIcon> = {
  strategies: Lightbulb,
  saved: Bookmark,
  circles: Users,
  garden: Flower2,
  account: UserRound,
  privacy: ShieldCheck,
  notifications: Bell,
  'prayer-times': Clock,
  appearance: Languages,
  about: Info,
};

/** From this width the two groups share a row (tablets, foldables open). */
const TWO_COLUMNS = 720;

const makeStyles = (_t: Theme) => ({
  group: { gap: space.xs },
  columns: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space['3xl'] },
  column: { flex: 1, minWidth: 0 },
});

export default function MoreScreen() {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const email = useAuthStore((s) => s.user?.email ?? null);
  const city = usePracticeStore((s) => s.prefs.prayer?.city ?? null);
  const english = i18n.language === 'en';

  const values: Partial<Record<MoreKey, string>> = {
    account: email ?? t('settings.signIn'),
    'prayer-times': city ? cityLabel(city, english ? 'en' : 'ar') : t('prayerTimes.notSet'),
    appearance: english ? t('settings.languageEn') : t('settings.languageAr'),
  };

  function open(entry: MoreItem) {
    const action = moreAction(entry, isSignedIn());
    if (action.kind === 'signIn') openSignIn(action.next);
    else router.push(action.href);
  }

  const groups = MORE_MENU.map((group) => (
    <View key={group.key} style={styles.group}>
      <SectionHeader title={t(group.titleKey)} size="heading" />
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
  ));

  return (
    <Screen>
      <AppHeader />
      <PageHeader title={t('tabs.more')} />
      {width >= TWO_COLUMNS ? (
        <View style={styles.columns}>
          {groups.map((g, i) => (
            <View key={i} style={styles.column}>
              {g}
            </View>
          ))}
        </View>
      ) : (
        groups.map((g, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <SectionDivider /> : null}
            {g}
          </React.Fragment>
        ))
      )}
    </Screen>
  );
}
