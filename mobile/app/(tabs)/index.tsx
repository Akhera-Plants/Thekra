/**
 * Home, after the website's home (frontend/src/app/[locale]/page.tsx), in its order: the brand bar with the tagline
 * («لِمَن كَانَ لَهُۥ قَلْبٌ», the site header's `.brand-message`), the entry question, the doors (Pathways: «أعنّي على ترك
 * معصية» filled, «أعنّي على فعل طاعة» quiet, «شُعَب الإيمان» compact like the site's `.pathway-faith` at phone width),
 * the compact «استكشف النصوص» door to the texts (app/browse.tsx), the ornament, the moments list, «تذكرة مختارة»
 * (the API's text of the day, with share and save) and «تذكير تعرف مصدره» (the source strip).
 * Guest-first: nothing here needs an account. Copy is the site's own (`home.*`).
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookOpen, DoorOpen, Heart, MessageCircle, Pause, Search, Sprout, Sun, type LucideIcon } from 'lucide-react-native';
import { useReminderOfTheDay } from '@/lib/api/quotes';
import { useSourceStripNames } from '@/lib/api/sources';
import { FeaturedReminder } from '@/components/home/FeaturedReminder';
import { SourceStrip } from '@/components/home/SourceStrip';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import { BrandBar, ListRow, Ornament, PageHeader, PathwayCard, Screen, Section, Text } from '@/ui';

interface Moment {
  href: Href;
  labelKey: string;
  icon: LucideIcon;
}

/** The site's curated moments (frontend/src/components/home/Moments.tsx), on the app's topic routes. */
const MOMENTS: Moment[] = [
  { href: '/sins/ghadab', labelKey: 'home.momentAnger', icon: Pause },
  { href: '/good-deeds/salah', labelKey: 'home.momentPrayer', icon: Sun },
  { href: '/sins/ghibah', labelKey: 'home.momentBackbiting', icon: MessageCircle },
  { href: '/good-deeds/kalam-tayyib', labelKey: 'home.momentKindness', icon: Heart },
];

const openSins = () => router.push('/sins');
const openGoodDeeds = () => router.push('/good-deeds');
const openBranches = () => router.push('/branches');
const openBrowse = () => router.push('/browse');

const makeStyles = (t: Theme) => ({
  doors: { gap: space.md },
  /** `.brand-message`: Amiri Quran, muted, after a hairline (English: the UI serif). */
  tagline: {
    borderStartWidth: 1,
    borderStartColor: t.colors.border,
    paddingStart: space.md,
    ...(t.english ? {} : { fontSize: 16, lineHeight: 30 }),
  },
});

/** The tagline is Quran text (Qaf 50:37) in Arabic, so it takes the Quran face; English reads it in the UI face. */
function Tagline() {
  const { t } = useTranslation();
  const { english } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Text variant={english ? 'small' : 'quran'} tone="muted" style={styles.tagline} numberOfLines={1}>
      {t('app.tagline')}
    </Text>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const reminder = useReminderOfTheDay();
  const sources = useSourceStripNames();
  const { refetch: refetchReminder } = reminder;
  const { refetch: refetchSources } = sources;

  const handleRetryReminder = useCallback(() => void refetchReminder(), [refetchReminder]);
  const handleRefresh = useCallback(() => {
    void refetchReminder();
    void refetchSources();
  }, [refetchReminder, refetchSources]);

  return (
    <Screen decor refreshing={reminder.isRefetching} onRefresh={handleRefresh}>
      <BrandBar trailing={<Tagline />} />

      <PageHeader eyebrow={t('home.eyebrow')} title={t('home.entryTitle')} />

      <View style={styles.doors}>
        <PathwayCard
          primary
          icon={DoorOpen}
          label={t('home.sinOverline')}
          title={t('home.sinEntryLabel')}
          body={t('home.sinEntryDescription')}
          action={t('home.sinCta')}
          onPress={openSins}
        />
        <PathwayCard
          icon={Sprout}
          label={t('home.deedOverline')}
          title={t('home.deedEntryLabel')}
          body={t('home.deedEntryDescription')}
          action={t('home.deedCta')}
          onPress={openGoodDeeds}
        />
        <PathwayCard
          size="row"
          icon={BookOpen}
          title={t('home.branchEntryLabel')}
          body={t('home.branchEntryDescription')}
          action={t('home.branchCta')}
          onPress={openBranches}
        />
        <PathwayCard
          size="row"
          icon={Search}
          title={t('home.browseTitle')}
          body={t('home.browseBody')}
          action={t('home.browseCta')}
          onPress={openBrowse}
        />
      </View>

      <Ornament />
      <Section title={t('home.momentsHeading')} lead={t('home.momentsLead')}>
        <View>
          {MOMENTS.map((moment) => (
            <ListRow key={moment.labelKey} icon={moment.icon} title={t(moment.labelKey)} onPress={() => router.push(moment.href)} />
          ))}
        </View>
      </Section>

      <FeaturedReminder
        quote={reminder.data}
        isLoading={reminder.isLoading}
        isError={reminder.isError}
        onRetry={handleRetryReminder}
      />

      <SourceStrip names={sources.data} isLoading={sources.isLoading} />
    </Screen>
  );
}
