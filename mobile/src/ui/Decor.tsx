/**
 * The website's line ornaments, drawn from its own files so the app and the site are one hand:
 * - `PageDecor`: the arabesque on the page edges (frontend/public/ornaments/arabesque-edge.svg, `.site-public:before`
 *   and `:after`), very faint (`decorOpacity`), behind everything, never touchable or read aloud;
 * - `Flourish`: the plants drawn in a card's end corner (`.pathway-flourish` on the filled door, `.olive-drawing` on
 *   the sage card), drawn for Arabic and mirrored for English like the site's `--art-mirror`;
 * - `Ornament`: the section ornament between sections (section-ornament.svg between two hairlines).
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { space, useStyles, useTheme, type Theme } from '@/theme';

/** arabesque-edge.svg: the two interlaced stems and one flower, repeated down the stem every 162 units. */
const EDGE_STEMS =
  'M134-30c-70 65-75 111-2 165s72 105-1 159-72 107 1 162 69 112-1 185M131-30c70 65 75 111 2 165s-72 105 1 159 72 107-1 162-69 112 1 185';
const EDGE_FLOWER =
  'M132 138c-27-37-13-58 0-70 13 12 27 33 0 70Zm0 0c-39-10-47-34-35-48 15 4 35 18 35 48Zm0 0c39-10 47-34 35-48-15 4-35 18-35 48Zm0 0c-18 22-10 36 0 46 10-10 18-24 0-46ZM99 115c-13-9-27-8-35 0 12 10 25 11 35 0Zm66 0c13-9 27-8 35 0-12 10-25 11-35 0ZM132 184c-22 14-30 33-23 49 18-11 24-26 23-49Zm0 0c22 14 30 33 23 49-18-11-24-26-23-49Z';
const EDGE_REPEATS = [0, 162, 324];
/** The file's 260-wide box widened to 265 so the motif's axis (x 132.5) is the box's centre. */
const EDGE_VIEW_W = 265;
const EDGE_VIEW_H = 620;
/** The site's desktop size (230 × 560, `contain`): the scale at which its 1.1 stroke reads as one fine line. */
const EDGE_SCALE = 0.885;
const EDGE_W = Math.round(EDGE_VIEW_W * EDGE_SCALE);
const EDGE_H = Math.round(EDGE_VIEW_H * EDGE_SCALE);
/** Where the top arabesque starts, beside the page title (the site sets it 95–130 below the page top). */
const EDGE_TOP = 96;

/** pathway-flourish (viewBox 150 × 160) and olive-drawing (112 × 170) from Pathways.tsx and FeaturedDeed.tsx. */
const SPRIG =
  'M-10 149c62-23 83-63 91-134M48 100c-23 0-40-15-43-37 24-1 43 16 43 37Zm20-34c-13-13-15-37-5-55 20 16 18 38 5 55Zm-22 38c35 5 65-9 79-33-35-7-62 5-79 33Zm-20 27c20 6 53 3 72-13-27-13-52-8-72 13Z';
const OLIVE =
  'M23 159c15-30 35-76 51-143M47 103c-25-1-34-17-30-36 19 2 32 19 30 36Zm11-30c-18-7-25-25-20-43 17 5 27 21 20 43Zm12-32c-9-8-10-23-3-35 11 10 12 24 3 35ZM38 124c25 9 48-2 57-20-22-7-43 0-57 20Zm17-37c22 4 40-8 45-28-21 0-37 8-45 28Zm12-37c19-1 30-13 31-31-18 4-28 15-31 31Z';

/** section-ornament.svg: six petals round a centre, a hairline with arrow tips on each side. */
const ORNAMENT_PETALS =
  'M28 14c-9-9-3-13 0-13 3 0 9 4 0 13Zm0 0c9 9 3 13 0 13-3 0-9-4 0-13Zm0 0c-12 0-13-7-9-9 4-2 10 1 9 9Zm0 0c12 0 13 7 9 9-4 2-10-1-9-9Zm0 0c0-10 9-12 11-8 2 4-3 8-11 8Zm0 0c0 10-9 12-11 8-2-4 3-8 11-8Z';
const ORNAMENT_TIPS = 'M18 14H3m35 0h15M3 14l4-3m-4 3 4 3m46-3-4-3m4 3-4 3';

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

const makeStyles = (t: Theme) => ({
  edgeTop: { position: 'absolute' as const, top: EDGE_TOP, start: -EDGE_W / 2, width: EDGE_W, height: EDGE_H },
  edgeBottom: {
    position: 'absolute' as const,
    bottom: 0,
    end: -EDGE_W / 2,
    width: EDGE_W,
    height: EDGE_H,
    transform: [{ rotate: '180deg' }],
  },
  ornamentRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.lg, paddingVertical: space.sm },
  ornamentLine: { flex: 1, height: 1, backgroundColor: t.colors.border },
});

function EdgeArt({ style }: { style: StyleProp<ViewStyle> }) {
  const { colors, decorOpacity } = useTheme();
  return (
    <View style={style}>
      <Svg width={EDGE_W} height={EDGE_H} viewBox={`0 0 ${EDGE_VIEW_W} ${EDGE_VIEW_H}`} fill="none">
        <G opacity={decorOpacity} stroke={colors.decor} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
          <Path d={EDGE_STEMS} />
          {EDGE_REPEATS.map((dy) => (
            <Path key={dy} d={EDGE_FLOWER} transform={`translate(0 ${dy})`} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

/**
 * Which background a page gets (owner, 2026-11-01: «the art fits the page»), all in the same hand (one fine line in
 * the decor colour at `decorOpacity`):
 * - `arabesque`: the website's page-edge arabesque (home and the reading pages);
 * - `sprig`: one large growing stem in the bottom end corner («ورد اليوم»: the day's growth);
 * - `olive`: the olive branch on the start edge near the top («عاداتي»: what is kept up and lasts).
 * Settings and forms take none.
 */
export type DecorKind = 'arabesque' | 'sprig' | 'olive';

/** Large single-plant placements (drawn for Arabic, mirrored for English like `Flourish`). */
const PLANT_ART: Record<'sprig' | 'olive', { d: string; w: number; h: number; width: number; place: ViewStyle }> = {
  sprig: { d: SPRIG, w: 150, h: 160, width: 250, place: { bottom: -36, end: -54 } },
  olive: { d: OLIVE, w: 112, h: 170, width: 170, place: { top: EDGE_TOP, start: -46 } },
};

function PlantArt({ kind }: { kind: 'sprig' | 'olive' }) {
  const { colors, decorOpacity, rtl } = useTheme();
  const art = PLANT_ART[kind];
  const height = Math.round((art.width * art.h) / art.w);
  return (
    <View style={[{ position: 'absolute', width: art.width, height, transform: [{ scaleX: rtl ? 1 : -1 }] }, art.place]}>
      <Svg width={art.width} height={height} viewBox={`0 0 ${art.w} ${art.h}`} fill="none">
        <Path d={art.d} stroke={colors.decor} strokeOpacity={decorOpacity * 1.6} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/**
 * The page background art. `arabesque`: half of the motif shows on the start edge near the top and, turned over, on
 * the end edge at the bottom. It fills its parent absolutely; render it first so the content draws over it.
 */
export function PageDecor({ kind = 'arabesque' }: { kind?: DecorKind }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', pointerEvents: 'none' }]} {...hidden}>
      {kind === 'arabesque' ? (
        <>
          <EdgeArt style={styles.edgeTop} />
          <EdgeArt style={styles.edgeBottom} />
        </>
      ) : (
        <PlantArt kind={kind} />
      )}
    </View>
  );
}

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
          <Path d={art.d} stroke={color} strokeOpacity={opacity} strokeWidth={strokeWidth / scale} strokeLinecap="round" strokeLinejoin="round" />
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

/** The site's section ornament (`OrnamentalDivider`): two hairlines and the six-petal mark between them. */
export function Ornament() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.ornamentRow} {...hidden}>
      <View style={styles.ornamentLine} />
      <Svg width={46} height={23} viewBox="0 0 56 28" fill="none">
        <G opacity={0.65} stroke={colors.decor} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round">
          <Path d={ORNAMENT_PETALS} />
          <Path d={ORNAMENT_TIPS} />
        </G>
      </Svg>
      <View style={styles.ornamentLine} />
    </View>
  );
}
