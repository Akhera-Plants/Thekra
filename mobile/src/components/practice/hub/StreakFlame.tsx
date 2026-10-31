/** The streak's flame (lucide `Flame`) in the theme's warm gold: a quiet count, never red. */

import React from 'react';
import { Flame } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { Icon } from '@/ui';

export function StreakFlame({ size = 18 }: { size?: number }) {
  const { colors } = useTheme();
  return <Icon icon={Flame} size={size} color={colors.gold} strokeWidth={1.8} />;
}
