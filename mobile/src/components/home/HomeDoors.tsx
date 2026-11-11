/**
 * «أبواب الخير» on the home page (owner round 6, C-06; docs/plan/2026-11-09-owner-round-6.md §8): the reference's
 * three doors and their drawings — a leaf for «أعنّي على فعل طاعة», an arched doorway for «تخفَّف من ذنب», an open
 * book for «شُعَب الإيمان» — redrawn here as react-native-svg line art (the same paths as the reference, viewBox
 * 240 × 260), behind the words in the card's inline-end corner and cut by its edge; mirrored in English.
 *
 * The cards keep our kit (type, radius, padding, hairline). The fills and the action's text, background and border are
 * the WEBSITE's exactly (frontend/src/app/site-public.css, last `.pathway-*` rules; globals.css tokens):
 * - the filled door: `--primary` fill and border, `--primary-foreground` ink, the action transparent with
 *   `--pathway-return-cta` (#ffffff) text and `--pathway-return-cta-border` (#bdd4c7) border;
 * - «تخفَّف»: `--sage` (= `--secondary`) fill, «شُعَب الإيمان»: `--paper` (= `--card`) fill, both with `--line` borders and
 *   the action transparent with `--green` text (`--primary`; dark: `--ring`) and a `--brand` (`--ring`) border.
 * One column on a phone (the reference's phone layout), three side by side on a wide screen.
 */

import React from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { G, Path } from 'react-native-svg';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { ForwardArrow, Text } from '@/ui';

/** The website's fixed pathway colours (globals.css `--pathway-return-*`, the same in light and dark). */
export const DOOR_CTA_ON_PRIMARY = { text: '#ffffff', border: '#bdd4c7' } as const;

type DoorKind = 'deeds' | 'sins' | 'faith';

/** The reference drawings (Thekra-Claude-Handoff `refinement.js`: botanicalArt, doorwayArt, faithArt). */
const ART: Record<DoorKind, { main: string; soft: string; stroke: number }> = {
  deeds: {
    main: 'M110 258c13-50 10-117 45-195M123 189c-56-7-73-41-59-79 36 1 61 30 59 79ZM132 156c47-7 77-37 66-75-37 2-65 30-66 75ZM142 111c-33-18-40-52-20-78 25 11 32 39 20 78ZM155 63c-3-28 9-48 31-53 8 26-7 48-31 53Z',
    soft: 'M66 112c20 26 39 52 57 77M132 156c19-25 40-49 66-75M123 34c8 27 15 53 19 77M155 63l31-53',
    stroke: 1.2,
  },
  sins: {
    main: 'M48 258V112a71 71 0 0 1 142 0v146M60 258V112a59 59 0 0 1 118 0v146M74 258V116a45 45 0 0 1 90 0v142M74 116l56-24v166M130 144l-8 3M25 258h184M119 30V17M33 110H17M207 110h16',
    soft: 'm168 233 35-20m-29 35 42-13M36 56l-9-11m168 11 10-11',
    stroke: 1.1,
  },
  faith: {
    main: 'M39 185c24-11 53-6 79 11 26-17 55-22 81-11V73c-26-8-53-1-81 16-28-17-55-24-79-16v112ZM118 89v107M27 81v116c31-8 60-2 91 16 31-18 60-24 93-16V81M53 90q24-4 49 11m-49 2q24-4 49 11m-49 2q24-4 49 11m-49 2q24-4 49 11m-49 2q24-4 49 11m-49 2q24-4 49 11m33-66q26-15 50-11m-50 24q26-15 50-11m-50 24q26-15 50-11m-50 24q26-15 50-11m-50 24q26-15 50-11',
    soft: 'M118 54V26m-14 14h28M60 44l6-13m109 13-6-13M47 228q70-13 142 0',
    stroke: 1.1,
  },
};

/** The drawing's box at phone width (the reference: 149 × 206, 8 from the top, 19 past the inline end). */
const ART_W = 149;
const ART_H = 206;

/** One line drawing, decorative (hidden from screen readers). */
export function DoorArt({ kind, color, opacity, width = ART_W, height = ART_H }: { kind: DoorKind; color: string; opacity: number; width?: number; height?: number }) {
  const { rtl } = useTheme();
  const art = ART[kind];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, pointerEvents: 'none', transform: [{ scaleX: rtl ? 1 : -1 }] }}
    >
      <Svg width={width} height={height} viewBox="0 0 240 260" fill="none">
        <G stroke={color} strokeOpacity={opacity} strokeWidth={art.stroke * (240 / width)} strokeLinecap="round" strokeLinejoin="round">
          <Path d={art.main} />
          <Path d={art.soft} strokeOpacity={opacity * 0.6} />
        </G>
      </Svg>
    </View>
  );
}

const makeStyles = (t: Theme) => ({
  doors: { gap: 15 },
  doorsRow: { flexDirection: 'row' as const, alignItems: 'stretch' as const, gap: 20 },
  door: {
    minHeight: 205,
    borderRadius: radius.panel,
    borderWidth: 1,
    paddingVertical: 23,
    paddingHorizontal: 22,
    overflow: 'hidden' as const,
    gap: space.xs,
  },
  doorWide: { flex: 1 },
  pressed: { transform: [{ scale: 0.985 }] },
  deeds: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  sins: { backgroundColor: t.colors.muted, borderColor: t.colors.border },
  faith: { backgroundColor: t.colors.card, borderColor: t.colors.border },
  /** A layer over the card whose row ends at the inline end in either direction; the drawing sits there and bleeds out. */
  artLayer: {
    position: 'absolute' as const,
    top: 8,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    alignItems: 'flex-start' as const,
  },
  art: { marginEnd: -19 },
  words: { maxWidth: '82%' as const, gap: space.xs },
  title: { marginTop: space.sm },
  cta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: space.lg,
    minHeight: 40,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    marginTop: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    backgroundColor: 'transparent',
    maxWidth: '100%' as const,
  },
});

interface DoorProps {
  kind: DoorKind;
  overline: string;
  title: string;
  body: string;
  action: string;
  href: Href;
  titleSize: number;
  titleLine: number;
  wide: boolean;
}

function Door({ kind, overline, title, body, action, href, titleSize, titleLine, wide }: DoorProps) {
  const styles = useStyles(makeStyles);
  const { colors, dark } = useTheme();
  const filled = kind === 'deeds';
  const ink = filled ? colors.primaryForeground : colors.foreground;
  const soft = filled ? DOOR_CTA_ON_PRIMARY.text : colors.mutedForeground;
  const cta = filled
    ? { color: DOOR_CTA_ON_PRIMARY.text, borderColor: DOOR_CTA_ON_PRIMARY.border }
    : { color: colors.link, borderColor: colors.ring };
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}. ${action}`}
      android_ripple={{ color: filled ? colors.ring : colors.accent }}
      style={({ pressed }) => [styles.door, styles[kind], wide && styles.doorWide, pressed && styles.pressed]}
    >
      <View style={styles.artLayer} pointerEvents="none">
        <View style={styles.art}>
          <DoorArt kind={kind} color={filled ? colors.pathwayFlourish : colors.ring} opacity={filled ? 0.32 : dark ? 0.13 : 0.2} />
        </View>
      </View>
      <View style={styles.words}>
        <Text variant="caption" style={{ color: soft }} numberOfLines={1}>
          {overline}
        </Text>
        <Text variant="title" style={[styles.title, { color: ink, fontSize: titleSize, lineHeight: titleLine }]}>
          {title}
        </Text>
        <Text variant="small" style={{ color: soft }}>
          {body}
        </Text>
      </View>
      <View style={[styles.cta, { borderColor: cta.borderColor }]}>
        <Text variant="small" weight="medium" style={{ color: cta.color }} numberOfLines={1}>
          {action}
        </Text>
        <ForwardArrow size={17} color={cta.color} />
      </View>
    </Pressable>
  );
}

/** The three doors, in the owner's order. */
export function HomeDoors() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const titleSize = width < 360 ? 23 : 26;
  const titleLine = Math.round(titleSize * 1.55);
  const common = { titleSize, titleLine, wide };
  return (
    <View style={wide ? styles.doorsRow : styles.doors}>
      <Door
        kind="deeds"
        overline={t('home.deedOverline')}
        title={t('home.deedEntryLabel')}
        body={t('home.deedEntryDescription')}
        action={t('home.deedCta')}
        href="/good-deeds"
        {...common}
      />
      <Door
        kind="sins"
        overline={t('home.sinOverline')}
        title={t('home.sinEntryLabel')}
        body={t('home.sinEntryDescription')}
        action={t('home.sinCta')}
        href="/sins"
        {...common}
      />
      <Door
        kind="faith"
        overline={t('home.branchOverline')}
        title={t('home.branchEntryLabel')}
        body={t('home.branchEntryDescription')}
        action={t('home.branchCta')}
        href="/branches"
        {...common}
      />
    </View>
  );
}
