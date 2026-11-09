/**
 * The circular chart of «قضاء الفوائت» (owner round 6, C-01a): a muted track and the share made up in the primary
 * colour, the percent in the middle (Western digits). react-native-svg; the arc starts at the top and runs with the
 * reading direction. Decorative for screen readers when `label` is given to the wrapper.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { I18nManager } from 'react-native';
import { qadaArc } from '@/lib/practice/hub-view';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

export function QadaRing({ done, owed, size = 120, label }: { done: number; owed: number; size?: number; label: string }) {
  const { colors } = useTheme();
  const stroke = Math.max(6, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = qadaArc(done, owed);
  const percent = Math.floor(share * 100);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }, { scaleY: I18nManager.isRTL ? -1 : 1 }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.muted} strokeWidth={stroke} fill="none" />
        {share > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.primary}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c * share} ${c}`}
          />
        ) : null}
      </Svg>
      <Text variant={size >= 100 ? 'title' : 'small'} weight="medium" style={{ fontVariant: ['tabular-nums'] }}>
        {`${percent}%`}
      </Text>
    </View>
  );
}
