/**
 * Home, after the website's home (frontend/src/app/[locale]/page.tsx): the brand bar, the entry question, the two
 * doors (Pathways: «أعنّي على ترك معصية» filled, «أعنّي على فعل طاعة» quiet), the ornament, and the moments list.
 * Guest-first: nothing here needs an account.
 * Copy is the site's own (`home.*`).
 */

import React from 'react';
import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DoorOpen, Heart, MessageCircle, Pause, Sprout, Sun, type LucideIcon } from 'lucide-react-native';
import { space } from '@/theme';
import { BrandBar, ListRow, Ornament, PageHeader, PathwayCard, Screen, Section } from '@/ui';

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

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <BrandBar />

      <PageHeader
        eyebrow={t('home.eyebrow')}
        title={t('home.entryTitle')}
      />

      <View style={{ gap: space.md }}>
        <PathwayCard
          primary
          icon={DoorOpen}
          label={t('home.sinOverline')}
          title={t('home.sinEntryLabel')}
          body={t('home.sinEntryDescription')}
          action={t('home.sinCta')}
          onPress={() => router.push('/sins')}
        />
        <PathwayCard
          icon={Sprout}
          label={t('home.deedOverline')}
          title={t('home.deedEntryLabel')}
          body={t('home.deedEntryDescription')}
          action={t('home.deedCta')}
          onPress={() => router.push('/good-deeds')}
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
    </Screen>
  );
}
