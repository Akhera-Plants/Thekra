/**
 * One plant of «بستاني»: its drawing, the habit's name and how many days it was tended (or that it is resting with
 * the user). A tap opens the plan (or صلة الرحم). No border or card: the plants stand on their own earth.
 */

import React, { memo, useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Text } from '@/ui';
import type { GardenPlant } from '@/lib/practice/garden';
import { PlantArt } from './PlantArt';

const makeStyles = (t: Theme) => ({
  tile: { alignItems: 'center' as const, gap: space.xs, paddingBottom: space.sm, borderRadius: radius.panel },
  pressed: { transform: [{ scale: 0.97 }], backgroundColor: t.colors.accent },
  words: { alignItems: 'center' as const, gap: 2, paddingHorizontal: space.xs },
});

export interface IGardenPlantTileProps {
  plant: GardenPlant;
  /** Tile width (half the page, two plants a row). */
  width: number;
}

export const GardenPlantTile = memo(function GardenPlantTile({ plant, width }: IGardenPlantTileProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const tended = t('garden.tended', { count: plant.tendedDays });
  const rest = plant.resting ? t('garden.restingPlant') : null;
  const label = [plant.title, t(`garden.stages.${plant.stage}`), tended, rest].filter(Boolean).join('. ');

  const handlePress = useCallback(() => {
    if (plant.planId) router.push(`/practice/plan/${plant.planId}`);
    else router.push('/practice/kinship');
  }, [plant.planId]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t(plant.kind === 'kinship' ? 'garden.openKinship' : 'garden.openPlan')}
      style={({ pressed }) => [styles.tile, { width }, pressed && styles.pressed]}
    >
      <PlantArt stage={plant.stage} resting={plant.resting} width={Math.min(width - space.lg, 150)} />
      <View style={styles.words}>
        <Text variant="body" weight="medium" align="center" numberOfLines={2}>
          {plant.title}
        </Text>
        <Text variant="caption" tone="muted" align="center" numberOfLines={2}>
          {tended}
        </Text>
        {rest ? (
          <Text variant="caption" tone="link" align="center" numberOfLines={1}>
            {rest}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
