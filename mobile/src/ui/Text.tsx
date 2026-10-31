/**
 * Text in the website's type scale (site-public.css at phone width). Arabic in IBM Plex Sans Arabic, English
 * in Source Serif 4. Sizes in dp, line heights as the site computes them.
 */

import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { QURAN_FONT, useTheme, type Theme } from '@/theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'lead'
  | 'small'
  | 'caption'
  | 'eyebrow'
  | 'label'
  | 'quran'
  | 'reading';

type Tone = 'default' | 'muted' | 'link' | 'primary' | 'destructive' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: Tone;
  weight?: 'regular' | 'medium' | 'semibold';
  align?: TextStyle['textAlign'];
}

/** [fontSize, lineHeight, default weight] per variant. */
const SCALE: Record<TextVariant, [number, number, 'regular' | 'medium' | 'semibold']> = {
  /** Page title (`h1`: 31 / 54, medium). */
  display: [31, 50, 'medium'],
  /** Section title (`.section-side-heading h2`: 23, medium). */
  title: [23, 38, 'medium'],
  /** Card and item title. */
  heading: [19, 32, 'medium'],
  /** Main text (17 / 1.7). */
  body: [17, 29, 'regular'],
  /** `.page-lead` at phone width (15 / 1.95). */
  lead: [15, 29, 'regular'],
  /** Buttons, links, meta (14). */
  small: [14, 23, 'regular'],
  /** Pills, breadcrumbs, source lines (13). */
  caption: [13, 22, 'regular'],
  /** `.eyebrow` (12–13, medium, primary). */
  eyebrow: [13, 21, 'medium'],
  /** Form labels. */
  label: [15, 24, 'medium'],
  /** Uthmani verse text (Amiri Quran, 20). */
  quran: [21, 42, 'regular'],
  /** Hadith and reviewed Arabic guidance (20 / loose). */
  reading: [19, 36, 'regular'],
};

export function textStyle(theme: Theme, variant: TextVariant, tone: Tone = 'default', weight?: TextProps['weight']): TextStyle {
  const [fontSize, lineHeight, defaultWeight] = SCALE[variant];
  const c = theme.colors;
  const color =
    tone === 'muted'
      ? c.mutedForeground
      : tone === 'link' || tone === 'primary'
        ? c.link
        : tone === 'destructive'
          ? c.destructive
          : tone === 'inverse'
            ? c.primaryForeground
            : c.foreground;
  const english = theme.english && variant !== 'quran';
  return {
    // Plex and Amiri carry tall ascenders; Android's extra font padding would double the leading.
    includeFontPadding: false,
    fontFamily: variant === 'quran' ? QURAN_FONT : theme.font(weight ?? defaultWeight),
    // Source Serif reads a step smaller than Plex at the same size (the site sets English body to 18).
    fontSize: english && variant !== 'display' ? fontSize + 1 : fontSize,
    lineHeight,
    color: variant === 'eyebrow' && tone === 'default' ? c.link : color,
  };
}

/** Reading text scales freely with the system font size; titles and chrome are bounded so layouts hold. */
const MAX_SCALE: Partial<Record<TextVariant, number>> = { display: 1.4, title: 1.4, caption: 1.5, eyebrow: 1.5, label: 1.5, small: 1.6 };

export function Text({ variant = 'body', tone, weight, align, style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      {...rest}
      style={[textStyle(theme, variant, tone, weight), align ? { textAlign: align } : null, style]}
    />
  );
}
