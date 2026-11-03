/** The streak's flame (lucide `Flame`) in the brand green: a quiet count, never red or gold (owner: brand greens only). */

import React from 'react';
import { Flame } from 'lucide-react-native';
import { Icon } from '@/ui';

export function StreakFlame({ size = 18 }: { size?: number }) {
  return <Icon icon={Flame} size={size} tone="link" strokeWidth={1.8} />;
}
