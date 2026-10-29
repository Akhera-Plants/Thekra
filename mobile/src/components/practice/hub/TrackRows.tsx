/**
 * The three tracks as the website's topic rows: «طاعاتي» (habits and their kind band), «صلة الرحم» (who is due now),
 * «ترك المعصية» (generic: «برنامجك الخاص» or «ابدأ»). Before anything was started, the same three become the start
 * choices, each with one line of the site's own copy.
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HeartHandshake, ShieldCheck, Sprout } from 'lucide-react-native';
import type { TrackSummary } from '@/lib/practice/use-habits-hub';
import { ListRow, Section } from '@/ui';

const openHabits = () => router.push('/practice/habits');
const openKinship = () => router.push('/practice/kinship');
const openProgram = () => router.push('/practice/sin-program');

export interface TrackRowsProps {
  summary: TrackSummary;
}

export function TrackRows({ summary }: TrackRowsProps) {
  const { t } = useTranslation();
  if (!summary.started) {
    return (
      <Section title={t('practice.hub.startTitle')} lead={t('practice.hub.startLead')}>
        <View>
          <ListRow icon={Sprout} title={t('practice.hub.habitsTrack')} hint={t('practice.noPlansHint')} onPress={openHabits} />
          <ListRow icon={HeartHandshake} title={t('kinship.title')} hint={t('kinship.lead')} onPress={openKinship} />
          <ListRow icon={ShieldCheck} title={t('sinProgram.title')} hint={t('sinProgram.lead')} onPress={openProgram} />
        </View>
      </Section>
    );
  }
  const habitsHint = [
    t('practice.hub.habitsCount', { count: summary.habits }),
    summary.band ? t(`practice.band.${summary.band}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Section title={t('practice.hub.tracks')}>
      <View>
        <ListRow icon={Sprout} title={t('practice.hub.habitsTrack')} hint={habitsHint} onPress={openHabits} />
        <ListRow
          icon={HeartHandshake}
          title={t('kinship.title')}
          hint={summary.hasRelatives ? t('practice.hub.kinshipDue', { count: summary.relativesDue }) : t('practice.hub.addRelativeHint')}
          onPress={openKinship}
        />
        <ListRow
          icon={ShieldCheck}
          title={t('sinProgram.title')}
          hint={t(summary.hasProgram ? 'practice.hub.programActive' : 'practice.hub.programStart')}
          onPress={openProgram}
        />
      </View>
    </Section>
  );
}
