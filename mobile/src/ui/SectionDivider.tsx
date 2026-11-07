/**
 * The website's flower separator between the sections of a page (frontend/src/components/shared/SectionDivider.tsx,
 * art frontend/public/ornaments/section-ornament.svg): a hairline on each side and the small flower with its arrow
 * line in the middle, pale sage (owner round 5, O-04 / A-05). Between SECTIONS only: items of one list keep the
 * plain hairline (`Rule`), and a section that follows a divider draws no rule of its own. Decorative: hidden from
 * screen readers. Sizes are the site's compact form at phone width (44 × 22, 16 gap).
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { space, useStyles, useTheme, type Theme } from '@/theme';

/** section-ornament.svg, path for path (viewBox 56 × 28). */
const PETALS =
  'M28 14c-9-9-3-13 0-13 3 0 9 4 0 13Zm0 0c9 9 3 13 0 13-3 0-9-4 0-13Zm0 0c-12 0-13-7-9-9 4-2 10 1 9 9Zm0 0c12 0 13 7 9 9-4 2-10-1-9-9Zm0 0c0-10 9-12 11-8 2 4-3 8-11 8Zm0 0c0 10-9 12-11 8-2-4 3-8 11-8Z';
const ARROWS = 'M18 14H3m35 0h15M3 14l4-3m-4 3 4 3m46-3-4-3m4 3-4 3';

const makeStyles = (t: Theme) => ({
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: space.lg, height: 22 },
  line: { flex: 1, height: 1, backgroundColor: t.colors.border },
});

export function SectionDivider({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(makeStyles);
  const { colors, dark } = useTheme();
  return (
    <View
      style={[styles.row, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      testID="section-divider"
    >
      <View style={styles.line} />
      <Svg width={44} height={22} viewBox="0 0 56 28" fill="none">
        {/* The site's `img{opacity:.65}` on #41816D; dark mode takes the readable sage of the dark palette. */}
        <G
          opacity={dark ? 0.55 : 0.65}
          stroke={dark ? colors.ring : colors.decor}
          strokeWidth={0.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d={PETALS} />
          <Path d={ARROWS} />
        </G>
      </Svg>
      <View style={styles.line} />
    </View>
  );
}
