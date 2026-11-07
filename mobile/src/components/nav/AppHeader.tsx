/**
 * The app header on every tab: the wordmark «ذكرى» with the tagline («لِمَن كَانَ لَهُۥ قَلْبٌ», the site header's
 * `.brand-message`) right next to it, and, for a member, ONE generic icon button «لحظة مجاهدة» on the opposite,
 * inline-end side (owner round 5, F-32 a / F-09). It names nothing personal: the moment screen picks the program in
 * focus on this device. The side menu is gone; its screens are in the «المزيد» tab.
 */

import React, { useCallback } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LifeBuoy } from 'lucide-react-native';
import { setMomentSource } from '@/lib/practice/practice-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import { BrandBar, IconButton, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  /** `.brand-message`: Amiri Quran, muted, after a hairline (English: the UI face). */
  tagline: {
    borderStartWidth: 1,
    borderStartColor: t.colors.border,
    paddingStart: space.md,
    ...(t.english ? {} : { fontSize: 15, lineHeight: 28 }),
  },
});

/** The tagline is Quran text (Qaf 50:37) in Arabic, so it takes the Quran face; English reads it in the UI face. */
function Tagline() {
  const { t } = useTranslation();
  const { english } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Text variant={english ? 'caption' : 'quran'} tone="muted" style={styles.tagline} numberOfLines={english ? 2 : 1}>
      {t('app.tagline')}
    </Text>
  );
}

export function AppHeader() {
  const { t } = useTranslation();
  const signedIn = useAuthStore((s) => s.user !== null);
  const handleMoment = useCallback(() => {
    setMomentSource(null);
    router.push('/practice/moment');
  }, []);
  return (
    <BrandBar
      tagline={<Tagline />}
      end={signedIn ? <IconButton icon={LifeBuoy} label={t('sinProgram.moment.title')} tone="default" bordered onPress={handleMoment} /> : undefined}
    />
  );
}
