/**
 * The website's palette, value for value: `:root` and `.dark` in frontend/src/app/globals.css
 * (Viridian/Shell). Change a colour there first, then here, so the site and the app stay one product.
 */

export interface Palette {
  background: string;
  foreground: string;
  card: string;
  /** Recessed surface: segment track, selected chip, next-step block (`--secondary` / `--muted`). */
  muted: string;
  mutedForeground: string;
  /** Pressed/hover surface (`--accent`). */
  accent: string;
  border: string;
  input: string;
  primary: string;
  primaryForeground: string;
  /**
   * Accent text and outline-button labels. Light: `--primary`, as on the site. Dark: the site's own dark accent
   * (`--ring`), because `--primary` on the dark background is 3.1:1, below the 4.5:1 small text needs (this is 9.4:1).
   */
  link: string;
  /** Focus ring and the next-step side rule (`--ring` / `--brand`). */
  ring: string;
  destructive: string;
  destructiveForeground: string;
  intentSin: string;
  intentSinForeground: string;
  intentGoodDeed: string;
  intentGoodDeedForeground: string;
  intentImanBranch: string;
  intentImanBranchForeground: string;
  gradeSahih: string;
  gradeSahihForeground: string;
  gradeHasan: string;
  gradeHasanForeground: string;
  gradeDaif: string;
  gradeDaifForeground: string;
  gradeMawdu: string;
  gradeMawduForeground: string;
  /** Primary at 10% (type pill, soft primary fills; Tailwind `bg-primary/10`). */
  primarySoft: string;
  /** Pathway-card flourish and quiet decoration. */
  flourish: string;
  overlay: string;
}

export const light: Palette = {
  background: '#fffcf9',
  foreground: '#263d35',
  card: '#fffefd',
  muted: '#edf4ef',
  mutedForeground: '#64746c',
  accent: '#f0f3ee',
  border: '#dce3db',
  input: '#dce3db',
  primary: '#326c59',
  primaryForeground: '#ffffff',
  link: '#326c59',
  ring: '#41816d',
  destructive: '#a0443a',
  destructiveForeground: '#fffcf9',
  intentSin: '#326c59',
  intentSinForeground: '#ffffff',
  intentGoodDeed: '#8a6a2f',
  intentGoodDeedForeground: '#ffffff',
  intentImanBranch: '#3d4a5c',
  intentImanBranchForeground: '#ffffff',
  gradeSahih: '#326c59',
  gradeSahihForeground: '#ffffff',
  gradeHasan: '#8a6a2f',
  gradeHasanForeground: '#ffffff',
  gradeDaif: '#8a948c',
  gradeDaifForeground: '#263d35',
  gradeMawdu: '#a0443a',
  gradeMawduForeground: '#fffcf9',
  primarySoft: 'rgba(50, 108, 89, 0.10)',
  flourish: '#d9e5d8',
  overlay: 'rgba(16, 16, 16, 0.45)',
};

export const dark: Palette = {
  background: '#101010',
  foreground: '#eeede9',
  card: '#181818',
  muted: '#1e1f1e',
  mutedForeground: '#aaa9a4',
  accent: '#242524',
  border: '#333532',
  input: '#333532',
  primary: '#326c59',
  primaryForeground: '#ffffff',
  link: '#8bc2aa',
  ring: '#8bc2aa',
  destructive: '#c45a4e',
  destructiveForeground: '#101010',
  intentSin: '#8bc2aa',
  intentSinForeground: '#101010',
  intentGoodDeed: '#c4a35a',
  intentGoodDeedForeground: '#101010',
  intentImanBranch: '#9aa3b2',
  intentImanBranchForeground: '#101010',
  gradeSahih: '#8bc2aa',
  gradeSahihForeground: '#101010',
  gradeHasan: '#c4a35a',
  gradeHasanForeground: '#101010',
  gradeDaif: '#6a6a66',
  gradeDaifForeground: '#eeede9',
  gradeMawdu: '#c45a4e',
  gradeMawduForeground: '#101010',
  primarySoft: 'rgba(50, 108, 89, 0.18)',
  flourish: '#2a3a32',
  overlay: 'rgba(0, 0, 0, 0.6)',
};
