/**
 * `Flourish`: the website's line plants drawn in a card's end corner (`.pathway-flourish` on the filled door,
 * `.olive-drawing` on the sage card), drawn for Arabic and mirrored for English like the site's `--art-mirror`.
 * Card art only: the pages themselves carry no background art (owner, 2026-11-03: it overlapped the text).
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';

/** pathway-flourish (viewBox 150 × 160) and olive-drawing (112 × 170) from Pathways.tsx and FeaturedDeed.tsx. */
const SPRIG =
  'M-10 149c62-23 83-63 91-134M48 100c-23 0-40-15-43-37 24-1 43 16 43 37Zm20-34c-13-13-15-37-5-55 20 16 18 38 5 55Zm-22 38c35 5 65-9 79-33-35-7-62 5-79 33Zm-20 27c20 6 53 3 72-13-27-13-52-8-72 13Z';
const OLIVE =
  'M23 159c15-30 35-76 51-143M47 103c-25-1-34-17-30-36 19 2 32 19 30 36Zm11-30c-18-7-25-25-20-43 17 5 27 21 20 43Zm12-32c-9-8-10-23-3-35 11 10 12 24 3 35ZM38 124c25 9 48-2 57-20-22-7-43 0-57 20Zm17-37c22 4 40-8 45-28-21 0-37 8-45 28Zm12-37c19-1 30-13 31-31-18 4-28 15-31 31Z';

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

export type FlourishKind = 'sprig' | 'olive';

/**
 * `box`: the drawing's own bounds (control points included, plus the stroke), so a contained plant is drawn whole:
 * the sprig's stem starts left of its file's viewBox, which cut it at the card's edge.
 */
const FLOURISH: Record<FlourishKind, { d: string; w: number; h: number; tilt: string; box: [number, number, number, number] }> = {
  sprig: { d: SPRIG, w: 150, h: 160, tilt: '0deg', box: [-12, 9, 139, 142] },
  olive: { d: OLIVE, w: 112, h: 170, tilt: '-9deg', box: [11, 4, 91, 157] },
};

export interface FlourishProps {
  /** `sprig`: the filled door's plant; `olive`: the olive branch of the sage card. */
  kind?: FlourishKind;
  /** Drawn width; the height follows the drawing. With `contained`, the side of the square it fits in, whole. */
  width: number;
  color: string;
  opacity: number;
  /** Placement, usually absolute in the card's end corner. */
  style?: StyleProp<ViewStyle>;
  /** Drawn in its own box in the layout (not absolute) and not tilted, so it stays whole inside that box. */
  contained?: boolean;
  /** Stroke width in dp (default 1.2). */
  strokeWidth?: number;
}

/** A line plant for a card's end corner, behind the card's text, or whole in a box of its own (`contained`). */
export function Flourish({ kind = 'sprig', width, color, opacity, style, contained, strokeWidth = 1.2 }: FlourishProps) {
  const { rtl } = useTheme();
  const art = FLOURISH[kind];
  const mirror = { scaleX: rtl ? 1 : -1 };
  if (contained) {
    // Fit the drawing's own bounds into a `width` square, whole (contain).
    const [x, y, w, h] = art.box;
    const scale = Math.min(width / w, width / h);
    const fit = { width: Math.round(w * scale), height: Math.round(h * scale) };
    return (
      <View {...hidden} style={[{ pointerEvents: 'none', ...fit, transform: [mirror] }, style]}>
        <Svg width={fit.width} height={fit.height} viewBox={`${x} ${y} ${w} ${h}`} fill="none">
          <Path
            d={art.d}
            stroke={color}
            strokeOpacity={opacity}
            strokeWidth={strokeWidth / scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }
  const height = Math.round((width * art.h) / art.w);
  return (
    <View
      {...hidden}
      style={[{ position: 'absolute', pointerEvents: 'none', width, height, transform: [mirror, { rotate: art.tilt }] }, style]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${art.w} ${art.h}`} fill="none">
        <Path d={art.d} stroke={color} strokeOpacity={opacity} strokeWidth={strokeWidth} />
      </Svg>
    </View>
  );
}
