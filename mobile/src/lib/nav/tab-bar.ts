/**
 * The bottom tab bar's icon treatment (owner, 2026-11-01): the soft green pill belongs to the current tab only, the
 * same for every tab. Before, «ورد اليوم» always drew a pill (grey when another tab was current), so it looked
 * selected all the time. Pure, so a test can hold every tab to the same rule.
 */

import type { Palette } from '@/theme/palette';

/** The pill behind a tab's icon (every tab reserves the same box, so icons and labels stay aligned). */
export const TAB_PILL = { width: 56, height: 28 } as const;

export interface TabIconLook {
  /** The pill's fill: the primary tint when current, nothing otherwise. */
  pill: string;
  strokeWidth: number;
}

/** How a tab's icon looks; the same answer for every tab. */
export function tabIconLook(focused: boolean, colors: Pick<Palette, 'primarySoft'>): TabIconLook {
  return focused ? { pill: colors.primarySoft, strokeWidth: 1.8 } : { pill: 'transparent', strokeWidth: 1.4 };
}
