/**
 * The home doors on every screen size (owner, 2026-11-01): small phones get tighter type and padding so a title
 * never wraps into a tall card; regular phones the site's phone sizes; tablets put the two main doors side by side
 * and cap the column so a card never stretches across a wide screen.
 */

export interface DoorLayout {
  /** The two main doors side by side. */
  columns: 1 | 2;
  /** Main-door title size and line height. */
  titleSize: number;
  titleLine: number;
  /** Main-door inner padding (all sides). */
  padding: number;
  /** Width of the drawn plant in the main door's corner. */
  flourish: number;
  /** The doors' column is capped at this width and centred. */
  maxWidth: number;
}

/** Below this width (iPhone SE 1st gen, small Androids at 320–359 dp) everything steps down. */
export const SMALL_PHONE = 360;
/** From this width (tablets, large foldables open) the main doors share a row. */
export const TABLET = 600;

export function doorLayout(width: number): DoorLayout {
  if (width >= TABLET) return { columns: 2, titleSize: 24, titleLine: 38, padding: 22, flourish: 120, maxWidth: 820 };
  if (width < SMALL_PHONE) return { columns: 1, titleSize: 20, titleLine: 32, padding: 16, flourish: 96, maxWidth: width };
  return { columns: 1, titleSize: 22, titleLine: 36, padding: 20, flourish: 112, maxWidth: width };
}
