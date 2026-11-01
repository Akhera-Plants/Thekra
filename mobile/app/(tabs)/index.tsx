/**
 * Home, after the website's home (frontend/src/app/[locale]/page.tsx), in its order: the app header («ذكرى» and the
 * tagline beside it, the menu opposite), «أبواب الخير» with the doors (owner, 2026-11-01: «أعنّي على فعل طاعة» first
 * and filled, «تخفَّف من معصية» quiet, then «شُعَب الإيمان» compact), the ornament, the moments list, «تذكرة مختارة» and
 * «تذكير تعرف مصدره». «مواسم الخير» and «استكشف النصوص» live in the side menu (owner, 2026-11-01: «ضمن القائمة»). The
 * doors size themselves to the screen (`doorLayout`: tighter on small phones, the two main doors side by side on tablets).
 * Guest-first: nothing here needs an account. Copy is the site's own (`home.*`).
 */

import React, { useCallback } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookOpen, DoorOpen, Heart, MessageCircle, Pause, Sprout, Sun, type LucideIcon } from 'lucide-react-native';
import { useReminderOfTheDay } from '@/lib/api/quotes';
import { useSourceStripNames } from '@/lib/api/sources';
import { FeaturedReminder } from '@/components/home/FeaturedReminder';
import { SourceStrip } from '@/components/home/SourceStrip';
import { AppHeader } from '@/components/nav/AppHeader';
import { doorLayout } from '@/lib/home/door-layout';
import { space, useStyles, type Theme } from '@/theme';
import { ListRow, Ornament, PageHeader, PathwayCard, Screen, Section } from '@/ui';

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

const makeStyles = (_t: Theme) => ({
  doors: { gap: space.md, width: '100%' as const, alignSelf: 'center' as const },
  mainDoors: { gap: space.md },
  mainDoorsRow: { flexDirection: 'row' as const, alignItems: 'stretch' as const },
  mainDoorRow: { flex: 1 },
});

export default function HomeScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const layout = doorLayout(width);
  const twoUp = layout.columns === 2;
  // The compact doors keep their words whole on phones: the action is a bare arrow there.
  const arrowOnly = !twoUp;
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
    <Screen decor="arabesque" refreshing={reminder.isRefetching} onRefresh={handleRefresh}>
      <AppHeader />

      <PageHeader eyebrow={t('home.eyebrow')} title={t('home.entryTitle')} />

      <View style={[styles.doors, { maxWidth: layout.maxWidth }]}>
        <View style={[styles.mainDoors, twoUp && styles.mainDoorsRow]}>
          <PathwayCard
            primary
            icon={Sprout}
            label={t('home.deedOverline')}
            title={t('home.deedEntryLabel')}
            body={t('home.deedEntryDescription')}
            action={t('home.deedCta')}
            onPress={openGoodDeeds}
            layout={layout}
            style={twoUp ? styles.mainDoorRow : undefined}
          />
          <PathwayCard
            icon={DoorOpen}
            label={t('home.sinOverline')}
            title={t('home.sinEntryLabel')}
            body={t('home.sinEntryDescription')}
            action={t('home.sinCta')}
            onPress={openSins}
            layout={layout}
            style={twoUp ? styles.mainDoorRow : undefined}
          />
        </View>
        <PathwayCard
          size="row"
          icon={BookOpen}
          title={t('home.branchEntryLabel')}
          body={t('home.branchEntryDescription')}
          action={t('home.branchCta')}
          onPress={openBranches}
          arrowOnly={arrowOnly}
        />
      </View>

      <Ornament />
      <Section title={t('home.momentsHeading')}>
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
