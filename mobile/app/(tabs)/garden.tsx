/**
 * «بستاني»: a calm garden that grows with the user's presence. One plant per habit plan, and one for صلة الرحم when
 * relatives exist; never anything for the sin program. A plant grows with the days anything was logged for it, never
 * shrinks, and rests with the user on «يومي ثقيل» (src/lib/practice/garden.ts). No streaks, no failure words, no
 * public counter: the garden lives in the device store and only its owner sees it.
 */

import React, { useCallback } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Lock, Moon } from 'lucide-react-native';
import { GardenPlantTile } from '@/components/garden/GardenPlantTile';
import { SeedBed } from '@/components/garden/PlantArt';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useGardenPlants } from '@/lib/practice/use-garden';
import { useHeavyDay } from '@/lib/practice/use-habits-hub';
import { GUTTER, space, useStyles, type Theme } from '@/theme';
import { Button, Notice, PageHeader, Screen, Skeleton, Text, TextLink } from '@/ui';

/** Widest the garden is laid out (tablets, web): two plants a row stay a garden, not a strip. */
const MAX_CONTENT_WIDTH = 560;
const SEED_BED_MAX_WIDTH = 320;
const SKELETON_TILES = ['s1', 's2'];

const makeStyles = (t: Theme) => ({
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, columnGap: space.lg, rowGap: space['2xl'] },
  empty: { alignItems: 'center' as const, gap: space.md, paddingVertical: space.xl },
  emptyWords: { alignItems: 'center' as const, gap: space.xs, paddingHorizontal: space.lg },
  quiet: { gap: space.lg },
  skeletonTile: { alignItems: 'center' as const, gap: space.sm },
  ground: { height: 1, alignSelf: 'stretch' as const, backgroundColor: t.colors.border },
});

function useLayoutWidths() {
  const { width } = useWindowDimensions();
  const content = Math.min(width, MAX_CONTENT_WIDTH) - 2 * GUTTER;
  return { content, tile: Math.floor((content - space.lg) / 2) };
}

export default function GardenScreen() {
  const hydrated = usePracticeStore((s) => s.hydrated);
  const { t } = useTranslation();
  return (
    <Screen decor>
      <PageHeader title={t('garden.title')} lead={t('garden.lead')} />
      {hydrated ? <Garden /> : <GardenSkeleton />}
    </Screen>
  );
}

function Garden() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const plants = useGardenPlants();
  const { heavy } = useHeavyDay();
  const widths = useLayoutWidths();
  const handlePlant = useCallback(() => router.push('/practice/add'), []);

  if (plants.length === 0) {
    return (
      <View style={styles.empty}>
        <SeedBed width={Math.min(widths.content, SEED_BED_MAX_WIDTH)} />
        <View style={styles.emptyWords}>
          <Text variant="heading" align="center">
            {t('garden.emptyTitle')}
          </Text>
          <Text variant="small" tone="muted" align="center">
            {t('garden.emptyHint')}
          </Text>
        </View>
        <Button label={t('garden.plantFirst')} onPress={handlePlant} arrow />
      </View>
    );
  }

  return (
    <>
      {heavy ? <Notice icon={Moon}>{t('garden.resting')}</Notice> : null}
      <View style={styles.grid}>
        {plants.map((plant) => (
          <GardenPlantTile key={plant.key} plant={plant} width={widths.tile} />
        ))}
      </View>
      <View style={styles.quiet}>
        <TextLink label={t('garden.plantAnother')} onPress={handlePlant} />
        <Notice icon={Lock}>{t('garden.privacy')}</Notice>
      </View>
    </>
  );
}

/** The shape of the garden while the device store loads: two plants on their earth. */
function GardenSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const widths = useLayoutWidths();
  return (
    <View style={styles.grid} accessibilityLabel={t('common.loading')}>
      {SKELETON_TILES.map((key) => (
        <View key={key} style={[styles.skeletonTile, { width: widths.tile }]}>
          <Skeleton width="70%" height={120} />
          <View style={styles.ground} />
          <Skeleton width="60%" height={16} />
          <Skeleton width="45%" height={12} />
        </View>
      ))}
    </View>
  );
}
