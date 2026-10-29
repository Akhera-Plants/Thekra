/**
 * A day's presence as a small mark, after the website's PresenceMark: an empty ring (nothing logged yet), a ring
 * filled in its lower half (some of it, «أي قدر يُحسب») or a full dot. Drawn in the accent text colour so it holds
 * in the dark theme, and in the primary ink on a filled (selected) day. Decorative: the day's button carries the
 * words. Without a level it keeps its space so the row does not jump.
 */

import React from 'react';
import { View } from 'react-native';
import type { PresenceMark } from '@/lib/practice/hub';
import { radius, useStyles, useTheme, type Theme } from '@/theme';

const SIZE = 8;

const makeStyles = (t: Theme) => ({
  dot: { width: SIZE, height: SIZE, borderRadius: radius.full, borderWidth: 1.2, borderColor: 'transparent', overflow: 'hidden' as const },
  half: { position: 'absolute' as const, start: 0, end: 0, bottom: 0, height: SIZE / 2 },
  empty: { borderColor: t.colors.mutedForeground, opacity: 0.6 },
});

export interface PresenceDotProps {
  /** Undefined: a day still to come (nothing drawn, space kept). */
  level: PresenceMark | undefined;
  /** On the primary fill of a selected day. */
  inverted?: boolean;
}

export function PresenceDot({ level, inverted }: PresenceDotProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const ink = inverted ? colors.primaryForeground : colors.link;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.dot,
        level === 'none' && (inverted ? { borderColor: ink, opacity: 0.6 } : styles.empty),
        level === 'partial' && { borderColor: ink },
        level === 'full' && { borderColor: ink, backgroundColor: ink },
      ]}
    >
      {level === 'partial' ? <View style={[styles.half, { backgroundColor: ink }]} /> : null}
    </View>
  );
}
