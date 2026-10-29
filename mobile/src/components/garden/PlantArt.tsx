/**
 * The plants of «بستاني», drawn by hand in the website's line style (src/ui/Decor.tsx: the sprig and the olive): thin
 * #41816D strokes, leaves washed with the pathway-flourish sage, on a soft mound of earth. One drawing per growth stage
 * (garden.ts), each a step on from the last, so a plant only ever gains. A resting plant («يومي ثقيل») keeps its drawing
 * and gains a crescent moon above it. Drawn for Arabic and mirrored for English, like the site's `--art-mirror`.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '@/theme';
import type { GrowthStage } from '@/lib/practice/garden';

const VIEW_W = 120;
const VIEW_H = 140;
const BED_W = 240;
const BED_H = 120;

/** [x, y, angle in degrees (0 points to the end of the drawing, -90 up), length]. */
type Leaf = readonly [number, number, number, number];
/** [x, y, angle the tip leans from upright]. */
type Tip = readonly [number, number, number];

interface StageArt {
  stems: readonly string[];
  leaves: readonly Leaf[];
  buds?: readonly Tip[];
  blossoms?: readonly Tip[];
}

const GROUND = 'M16 124C34 119 86 119 104 124';
const SOIL = 'M28 128h5M52 129.5h7M84 128h6';
const SEED = 'M60 117C64.5 119 65.5 124 60 127C54.5 124 55.5 119 60 117Z';
const MOON = 'M99 12C92.5 13.5 88 19 88 25C88 32 94 37 101 36C96 33.5 93 29 93 24C93 19 95.5 14.5 99 12Z';

const BUSH_STEM = 'M60 124C58 104 63 86 60 68C58 58 60 51 61 45';
const BUSH_BRANCHES = ['M60 102C53 97 47 93 40 86', 'M60 84C67 79 73 76 80 69'];
const BUSH_LEAVES: readonly Leaf[] = [
  [60, 117, -155, 15],
  [60, 111, -25, 15],
  [50, 95, -110, 11],
  [46, 92, -170, 10],
  [70, 78, -70, 11],
  [60, 92, -30, 15],
  [60, 74, -150, 15],
  [60, 62, -40, 13],
];
const BUSH_TIPS: readonly Tip[] = [
  [40, 86, -40],
  [80, 69, 40],
  [61, 45, 0],
];

const STAGES: Record<Exclude<GrowthStage, 0>, StageArt> = {
  1: {
    stems: ['M60 124C60 117 61 111 60 105'],
    leaves: [
      [60, 107, -150, 13],
      [60, 105, -35, 14],
    ],
  },
  2: {
    stems: ['M60 124C59 112 62 100 60 88C59 84 60 81 60 79'],
    leaves: [
      [60, 113, -155, 15],
      [60, 104, -28, 16],
      [60, 94, -150, 15],
      [60, 80, -120, 9],
      [60, 80, -62, 9],
    ],
  },
  3: {
    stems: ['M60 124C58 106 63 90 60 72C59 66 60 61 61 57', 'M60 100C66 95 72 92 79 87'],
    leaves: [
      [60, 116, -155, 16],
      [60, 110, -25, 15],
      [68, 94, -80, 10],
      [79, 87, -30, 13],
      [60, 90, -150, 17],
      [60, 80, -35, 16],
      [60, 70, -145, 14],
      [61, 58, -115, 10],
      [61, 58, -65, 10],
    ],
  },
  4: { stems: [BUSH_STEM, ...BUSH_BRANCHES], leaves: BUSH_LEAVES, buds: BUSH_TIPS },
  5: {
    stems: [BUSH_STEM, ...BUSH_BRANCHES, 'M60 66C55 62 52 58 49 53'],
    leaves: BUSH_LEAVES,
    blossoms: [...BUSH_TIPS, [49, 53, -20]],
  },
};

/** A leaf pointing along +x from its stalk, a little fuller on one side like the sprig's leaves. */
function leafPath(length: number): string {
  const w = length * 0.38;
  const l = length;
  return `M0 0C${l * 0.25} ${-w} ${l * 0.68} ${-w * 0.95} ${l} 0C${l * 0.62} ${w * 0.7} ${l * 0.22} ${w * 0.75} 0 0Z`;
}

const BUD = 'M0 0C-3.6 -2.6 -3.8 -8.4 0 -12.5C3.8 -8.4 3.6 -2.6 0 0Z';
const SEPALS = 'M-3.2 1.6L0 0L3.2 1.6';
const PETAL = 'M0 0C-3.4 -2.8 -3.6 -7.6 0 -10C3.6 -7.6 3.4 -2.8 0 0Z';
const PETAL_ANGLES = [0, 72, 144, 216, 288];

function useInk() {
  const { colors, dark, rtl } = useTheme();
  return {
    // The ornaments' green; on the dark page the site's own dark accent, so the lines stay visible.
    stroke: dark ? colors.link : colors.decor,
    fill: colors.pathwayFlourish,
    fillOpacity: dark ? 0.16 : 0.9,
    mirror: rtl ? 1 : -1,
  };
}

function StageDrawing({ art, stroke, fill, fillOpacity }: { art: StageArt; stroke: string; fill: string; fillOpacity: number }) {
  return (
    <G stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
      {art.stems.map((d) => (
        <Path key={d} d={d} strokeWidth={1.3} fill="none" />
      ))}
      {art.leaves.map(([x, y, angle, length]) => (
        <G key={`${x}-${y}-${angle}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
          <Path d={leafPath(length)} strokeWidth={1.05} fill={fill} fillOpacity={fillOpacity} />
          <Path d={`M${length * 0.12} 0L${length * 0.78} 0`} strokeWidth={0.7} strokeOpacity={0.6} />
        </G>
      ))}
      {art.buds?.map(([x, y, angle]) => (
        <G key={`bud-${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
          <Path d={BUD} strokeWidth={1.05} fill={fill} fillOpacity={fillOpacity} />
          <Path d={SEPALS} strokeWidth={1} fill="none" />
        </G>
      ))}
      {art.blossoms?.map(([x, y, angle]) => (
        <G key={`bloom-${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
          {PETAL_ANGLES.map((a) => (
            <Path key={a} d={PETAL} transform={`rotate(${a})`} strokeWidth={1} fill={fill} fillOpacity={fillOpacity} />
          ))}
          <Circle r={1.8} fill={stroke} stroke="none" />
        </G>
      ))}
    </G>
  );
}

export interface PlantArtProps {
  stage: GrowthStage;
  resting?: boolean;
  /** Drawn width; the height follows the drawing. */
  width: number;
}

/** One plant at its stage, on its mound of earth. Decorative: the tile around it carries the words. */
export function PlantArt({ stage, resting, width }: PlantArtProps) {
  const { stroke, fill, fillOpacity, mirror } = useInk();
  const height = Math.round((width * VIEW_H) / VIEW_W);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, transform: [{ scaleX: mirror }] }}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} fill="none">
        {stage === 0 ? (
          <Path d={SEED} stroke={stroke} strokeWidth={1.1} fill={fill} fillOpacity={fillOpacity} />
        ) : (
          <StageDrawing art={STAGES[stage]} stroke={stroke} fill={fill} fillOpacity={fillOpacity} />
        )}
        <Path d={GROUND} stroke={stroke} strokeWidth={1.2} strokeLinecap="round" />
        <Path d={SOIL} stroke={stroke} strokeWidth={1} strokeLinecap="round" strokeOpacity={0.45} />
        {resting ? (
          <Path d={MOON} stroke={stroke} strokeWidth={1} strokeLinejoin="round" fill={fill} fillOpacity={fillOpacity} />
        ) : null}
      </Svg>
    </View>
  );
}

const BED_GROUND = 'M18 96C70 86 170 86 222 96';
const BED_SOIL = 'M40 101h7M92 102h9M146 102h8M196 101h6';
const BED_SEED = 'M120 82C124.5 84 125.5 89 120 92C114.5 89 115.5 84 120 82Z';
/** Where the next seeds will go: two faint marks either side of the first. */
const BED_MARKS = 'M70 88.5h4M166 88.5h4';

/** The empty garden: a long bed of earth with one seed waiting in it. */
export function SeedBed({ width }: { width: number }) {
  const { stroke, fill, fillOpacity, mirror } = useInk();
  const height = Math.round((width * BED_H) / BED_W);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, transform: [{ scaleX: mirror }] }}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${BED_W} ${BED_H}`} fill="none">
        <Path d={BED_SEED} stroke={stroke} strokeWidth={1.1} fill={fill} fillOpacity={fillOpacity} />
        <Path d={BED_GROUND} stroke={stroke} strokeWidth={1.2} strokeLinecap="round" />
        <Path d={BED_SOIL} stroke={stroke} strokeWidth={1} strokeLinecap="round" strokeOpacity={0.45} />
        <Path d={BED_MARKS} stroke={stroke} strokeWidth={1} strokeLinecap="round" strokeOpacity={0.35} />
      </Svg>
    </View>
  );
}
