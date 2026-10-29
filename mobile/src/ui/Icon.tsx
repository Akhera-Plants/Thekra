/**
 * Icons: lucide, the same set and version as the website (lucide-react 1.51.0), drawn thin like the site
 * (site-public.css strokes 1.2–1.4). Directional icons point the reading way and flip in RTL.
 */

import React from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme';

export type IconTone = 'default' | 'muted' | 'link' | 'inverse' | 'destructive';

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  tone?: IconTone;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ icon: Glyph, size = 20, tone = 'default', color, strokeWidth = 1.4 }: IconProps) {
  const { colors } = useTheme();
  const fill =
    color ??
    (tone === 'muted'
      ? colors.mutedForeground
      : tone === 'link'
        ? colors.link
        : tone === 'inverse'
          ? colors.primaryForeground
          : tone === 'destructive'
            ? colors.destructive
            : colors.foreground);
  return <Glyph size={size} color={fill} strokeWidth={strokeWidth} absoluteStrokeWidth />;
}

/** «←» in Arabic, «→» in English: the site's DirectionalArrow (forward in the reading direction). */
export function ForwardArrow(props: Omit<IconProps, 'icon'>) {
  const { rtl } = useTheme();
  return <Icon icon={rtl ? ArrowLeft : ArrowRight} {...props} />;
}

export function ForwardChevron(props: Omit<IconProps, 'icon'>) {
  const { rtl } = useTheme();
  return <Icon icon={rtl ? ChevronLeft : ChevronRight} {...props} />;
}

export function BackChevron(props: Omit<IconProps, 'icon'>) {
  const { rtl } = useTheme();
  return <Icon icon={rtl ? ChevronRight : ChevronLeft} {...props} />;
}
