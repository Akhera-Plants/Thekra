/**
 * Design tokens for Thekra mobile.
 *
 * 🎨 PHASE 8 SWAP POINT — all hex values in this file are PLACEHOLDER tokens.
 * When Phase 8 (design system) lands, replace ONLY the values in this file.
 * Token names (Colors.primary, Colors.intentSin, etc.) must remain unchanged.
 *
 * Never hardcode hex/rgb/hsl/oklch anywhere else in the app — reference tokens here.
 */

// ── Colours ──────────────────────────────────────────────────────────────────

export const Colors = {
  // Backgrounds
  background: '#FFFFFF',
  backgroundDark: '#0F1117',
  card: '#F7F8FA',
  cardDark: '#1A1D24',
  overlay: 'rgba(0,0,0,0.45)',

  // Text
  text: '#1A202C',
  textDark: '#F0F2F5',
  textMuted: '#718096',
  textMutedDark: '#A0AEC0',
  textInverse: '#FFFFFF',

  // Primary brand (Islamic teal-blue)
  primary: '#1B6CA8',
  primaryLight: '#E8F4FD',
  primaryDark: '#0F4C7A',

  // Semantic intent colours
  intentSin: '#7C3049',           // serious / muted red — sin-related screens
  intentSinLight: '#FEF2F6',
  intentGoodDeed: '#1A6B47',      // positive / green — good-deed screens
  intentGoodDeedLight: '#F0FFF7',

  // Hadith grade colours (GradeBadge)
  gradeSahih: '#1A6B47',
  gradeSahihBg: '#F0FFF4',
  gradeHasan: '#2B6CB0',
  gradeHasanBg: '#EBF8FF',
  gradeDaif: '#C05621',
  gradeDaifBg: '#FFFAF0',
  gradeMawdu: '#9B2C2C',
  gradeMawduBg: '#FFF5F5',
  gradeUngraded: '#4A5568',       // Quran / ungraded — no hadith grade
  gradeUngradedBg: '#F7FAFC',

  // UI structure
  border: '#E2E8F0',
  borderDark: '#2D3748',
  separator: '#EDF2F7',
  separatorDark: '#252D3A',

  // Status
  success: '#1A6B47',
  error: '#C53030',
  warning: '#C05621',
  info: '#2B6CB0',

  // Interactive
  tint: '#1B6CA8',
  tabIconDefault: '#9CA3AF',
  tabIconSelected: '#1B6CA8',
} as const;

export type ColorKey = keyof typeof Colors;

// ── Spacing ───────────────────────────────────────────────────────────────────
// Based on a 4-point grid.

export const Spacing = {
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
} as const;

// ── Typography ────────────────────────────────────────────────────────────────

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 19,
  '2xl': 23,
  '3xl': 28,
  '4xl': 34,
} as const;

export const LineHeight = {
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  /** Arabic body text — generous line height for tashkeel readability */
  arabic: 1.9,
} as const;

// ── Radius ────────────────────────────────────────────────────────────────────

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// ── Elevation / Shadow ────────────────────────────────────────────────────────

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
} as const;
