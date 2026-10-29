/**
 * The three tracks after the website's hub (TrackLinks): «طاعاتي» (habits and their kind band), «صلة الرحم» (who is
 * due now), «ترك المعصية» (generic: «برنامجك الخاص» or «ابدأ»), each a row with its icon on a sage disc, one quiet line
 * of where it stands and a forward arrow. Before anything was started, the same three are the doors to begin, drawn
 * like the home's pathway doors: habits filled and kinship quiet side by side (the site's phone grid), the private
 * program as the compact door under them.
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HeartHandshake, ShieldCheck, Sprout, Users, type LucideIcon } from 'lucide-react-native';
import type { TrackSummary } from '@/lib/practice/use-habits-hub';
import { radius, space, useStyles, type Theme } from '@/theme';
import { ForwardArrow, Icon, PathwayCard, Section, Text } from '@/ui';

const DISC = 40;

const openHabits = () => router.push('/practice/habits');
const openKinship = () => router.push('/practice/kinship');
const openProgram = () => router.push('/practice/sin-program');
const openCircles = () => router.push('/circles');
const startHabit = () => router.push('/practice/add');
const startKinship = () => router.push({ pathname: '/practice/kinship', params: { add: '1' } });

const makeStyles = (t: Theme) => ({
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 72,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  rowPressed: { backgroundColor: t.colors.accent },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: radius.full,
    backgroundColor: t.colors.muted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  texts: { flex: 1, gap: 2 },
  doors: { gap: space.md },
  pair: { flexDirection: 'row' as const, gap: space.md },
});

interface TrackRowProps {
  icon: LucideIcon;
  title: string;
  meta: string;
  onPress: () => void;
}

function TrackRow({ icon, title, meta, onPress }: TrackRowProps) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${meta}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.disc}>
        <Icon icon={icon} size={19} tone="link" />
      </View>
      <View style={styles.texts}>
        <Text variant="body" weight="medium" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {meta}
        </Text>
      </View>
      <ForwardArrow size={17} tone="muted" />
    </Pressable>
  );
}

/** First visit: the three ways to begin, as doors. */
function StartDoors() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Section title={t('practice.hub.startTitle')} lead={t('practice.hub.startLead')}>
      <View style={styles.doors}>
        <View style={styles.pair}>
          <PathwayCard
            primary
            size="half"
            icon={Sprout}
            title={t('practice.hub.habitsTrack')}
            body={t('practice.noPlansHint')}
            action={t('practice.hub.startHabitCta')}
            onPress={startHabit}
          />
          <PathwayCard
            size="half"
            icon={HeartHandshake}
            title={t('kinship.title')}
            body={t('practice.hub.addRelativeHint')}
            action={t('practice.hub.startKinshipCta')}
            onPress={startKinship}
          />
        </View>
        <PathwayCard
          size="row"
          icon={ShieldCheck}
          title={t('sinProgram.title')}
          body={t('practice.hub.addProgramHint')}
          action={t('practice.hub.programStart')}
          onPress={openProgram}
        />
      </View>
    </Section>
  );
}

export interface TrackRowsProps {
  summary: TrackSummary;
}

export function TrackRows({ summary }: TrackRowsProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  if (!summary.started) return <StartDoors />;
  const habitsMeta = [
    t('practice.hub.habitsCount', { count: summary.habits }),
    summary.band ? t(`practice.band.${summary.band}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Section title={t('practice.hub.tracks')}>
      <View style={styles.list}>
        <TrackRow icon={Sprout} title={t('practice.hub.habitsTrack')} meta={habitsMeta} onPress={openHabits} />
        <TrackRow
          icon={HeartHandshake}
          title={t('kinship.title')}
          meta={summary.hasRelatives ? t('practice.hub.kinshipDue', { count: summary.relativesDue }) : t('practice.hub.addRelativeHint')}
          onPress={openKinship}
        />
        <TrackRow
          icon={ShieldCheck}
          title={t('sinProgram.title')}
          meta={t(summary.hasProgram ? 'practice.hub.programActive' : 'practice.hub.programStart')}
          onPress={openProgram}
        />
        <TrackRow icon={Users} title={t('circles.title')} meta={t('circles.trackMeta')} onPress={openCircles} />
      </View>
    </Section>
  );
}
