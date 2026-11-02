/**
 * A calm ring that fills over the ten minutes of «لحظة مجاهدة». It never animates: it steps once a second, and with
 * «تقليل الحركة» on it steps only every 15 seconds. Colours are theme tokens.
 */

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useStyles, useTheme } from '@/theme';

const SIZE = 200;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** With reduced motion the fill moves in 40 steps (15 s each over 10 minutes). */
const REDUCED_STEPS = 40;

const makeStyles = () => ({
  root: { width: SIZE, height: SIZE, alignItems: 'center' as const, justifyContent: 'center' as const, alignSelf: 'center' as const },
  svg: { position: 'absolute' as const, top: 0, left: 0, transform: [{ rotate: '-90deg' }] },
});

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

export function ProgressRing({ fraction, label, children }: { fraction: number; label: string; children?: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, fraction));
  const shown = reduced ? Math.floor(clamped * REDUCED_STEPS) / REDUCED_STEPS : clamped;
  return (
    <View style={styles.root} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.border} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.primary}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - shown)}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}
