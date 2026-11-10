/**
 * The profile mark (owner round 7, R7-A5: «غيّر ايقونة البروفايل لوحدة احلى واسلس»): a soft green disc with a thin
 * ring and a rounded head-and-shoulders glyph drawn in our own strokes — no stock silhouette, no letters joined
 * into a monogram. The website draws the same mark (frontend/src/components/shared/ProfileMark.tsx).
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/theme';

export function ProfileMark({ size = 32 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <Circle cx={16} cy={12.6} r={4.6} stroke={colors.link} strokeWidth={1.6} />
        <Path d="M7.6 26.4c1.5-4.4 4.6-6.6 8.4-6.6s6.9 2.2 8.4 6.6" stroke={colors.link} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
