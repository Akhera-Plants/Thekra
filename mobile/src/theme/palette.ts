/**
 * The website's palette, value for value: `:root` and `.dark` in frontend/src/app/globals.css
 * (Viridian/Shell). Change a colour there first, then here, so the site and the app stay one product.
 *
 * Owner round 7 (R7-A1): the green stays; every cream, ivory and gold that came with it is gone. Surfaces are white
 * or a near-white with the faintest cool cast, light text on the green is pure white, and the accents that were gold
 * (good deeds, «حسن», the streak flame) are a deep teal from the green family. Dark: neutral greys, no warm cast.
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
  /** Hairlines between items of one list and card edges: decorative, never the only sign of a control. */
  border: string;
  /**
   * Edges of interactive controls (text fields, the switch when off, chips, outline buttons): ≥3:1 on the page
   * and on cards (WCAG 1.4.11, owner round 5 A-18). `border` stays for separators only.
   */
  controlBorder: string;
  /** @deprecated The input edge is `controlBorder`; kept equal to it for older callers. */
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
  /** Destructive at ~10%: the soft circle behind a ConfirmDialog's warning mark. */
  destructiveSoft: string;
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
  /** Stroke of the line drawings (the garden's plants): #41816D in both themes, as the site's ornaments. */
  decor: string;
  /** The plant drawn on the filled pathway card (`--pathway-flourish`, the same in both themes). */
  pathwayFlourish: string;
  overlay: string;
}

export const light: Palette = {
  background: '#fbfcfb',
  foreground: '#263d35',
  card: '#ffffff',
  muted: '#edf4ef',
  /** 4.96:1 on `muted`, 5.4:1 on the page (A-18; the site's `--muted-foreground`). */
  mutedForeground: '#5c6c64',
  accent: '#f0f3ee',
  border: '#dce3db',
  /** 3.3:1 on the page, 3.1:1 on `muted`. */
  controlBorder: '#838d85',
  input: '#838d85',
  primary: '#326c59',
  primaryForeground: '#ffffff',
  link: '#326c59',
  ring: '#41816d',
  destructive: '#a0443a',
  destructiveForeground: '#ffffff',
  destructiveSoft: 'rgba(160, 68, 58, 0.10)',
  intentSin: '#326c59',
  intentSinForeground: '#ffffff',
  /** Deep teal (was gold): 6.5:1 with white, 5.8:1 on `muted`. */
  intentGoodDeed: '#2a6670',
  intentGoodDeedForeground: '#ffffff',
  intentImanBranch: '#3d4a5c',
  intentImanBranchForeground: '#ffffff',
  gradeSahih: '#326c59',
  gradeSahihForeground: '#ffffff',
  gradeHasan: '#2a6670',
  gradeHasanForeground: '#ffffff',
  gradeDaif: '#8a948c',
  gradeDaifForeground: '#263d35',
  gradeMawdu: '#a0443a',
  gradeMawduForeground: '#ffffff',
  primarySoft: 'rgba(50, 108, 89, 0.10)',
  flourish: '#d9e5d8',
  decor: '#41816d',
  pathwayFlourish: '#d9e5d8',
  overlay: 'rgba(24, 40, 34, 0.42)',
};

export const dark: Palette = {
  background: '#101010',
  foreground: '#eceeed',
  card: '#181818',
  muted: '#1e1f1e',
  mutedForeground: '#a7aba9',
  accent: '#242524',
  border: '#333532',
  /** 4.0:1 on the page, 3.4:1 on `muted`. */
  controlBorder: '#6f7371',
  input: '#6f7371',
  primary: '#326c59',
  primaryForeground: '#ffffff',
  link: '#8bc2aa',
  ring: '#8bc2aa',
  /** 4.9:1 on `muted`, 5.6:1 on the page (the site's dark `--destructive`). */
  destructive: '#d46e62',
  destructiveForeground: '#101010',
  destructiveSoft: 'rgba(212, 110, 98, 0.16)',
  intentSin: '#8bc2aa',
  intentSinForeground: '#101010',
  intentGoodDeed: '#86bfc6',
  intentGoodDeedForeground: '#101010',
  intentImanBranch: '#9aa3b2',
  intentImanBranchForeground: '#101010',
  gradeSahih: '#8bc2aa',
  gradeSahihForeground: '#101010',
  gradeHasan: '#86bfc6',
  gradeHasanForeground: '#101010',
  gradeDaif: '#686c6a',
  gradeDaifForeground: '#eceeed',
  gradeMawdu: '#d46e62',
  gradeMawduForeground: '#101010',
  primarySoft: 'rgba(50, 108, 89, 0.18)',
  flourish: '#2a3a32',
  decor: '#41816d',
  pathwayFlourish: '#d9e5d8',
  overlay: 'rgba(0, 0, 0, 0.6)',
};
