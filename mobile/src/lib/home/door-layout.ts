/**
 * The home doors on every screen size (owner, 2026-11-01): small phones get tighter type and padding so a title
 * never wraps into a tall card; regular phones the site's phone sizes; tablets put the two main doors side by side
 * and cap the column so a card never stretches across a wide screen. The plant drawing has its own square at the
 * card's bottom inline-end corner (`art`), drawn whole inside it: never cut by the card's edge, never under the words.
 */

export interface DoorLayout {
  /** The two main doors side by side. */
  columns: 1 | 2;
  /** Main-door title size and line height. */
  titleSize: number;
  titleLine: number;
  /** Main-door inner padding (all sides). */
  padding: number;
  /** Side of the square the plant is drawn in (the words keep the rest of the width). */
  art: number;
  /** The doors' column is capped at this width and centred. */
  maxWidth: number;
}

/** Below this width (iPhone SE 1st gen, small Androids at 320–359 dp) everything steps down. */
export const SMALL_PHONE = 360;
/** From this width (tablets, large foldables open) the main doors share a row. */
export const TABLET = 600;

export function doorLayout(width: number): DoorLayout {
  if (width >= TABLET) return { columns: 2, titleSize: 24, titleLine: 38, padding: 22, art: 84, maxWidth: 820 };
  if (width < SMALL_PHONE) return { columns: 1, titleSize: 20, titleLine: 32, padding: 16, art: 60, maxWidth: width };
  return { columns: 1, titleSize: 22, titleLine: 36, padding: 20, art: 76, maxWidth: width };
}
