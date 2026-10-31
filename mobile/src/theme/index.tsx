/**
 * App theme: the website's palette and faces, light and dark, following the system or the user's choice
 * (Settings, like the site's theme button). `useTheme()` gives colours, fonts and direction; `useStyles()`
 * builds a StyleSheet from them, rebuilt only when the theme or language changes.
 */

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { I18nManager, StyleSheet, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { dark, light, type Palette } from './palette';
import { uiFont, type FontWeightName } from './fonts';

export type ThemePreference = 'system' | 'light' | 'dark';

const PREF_KEY = 'thekra.theme';

interface PrefState {
  pref: ThemePreference;
  setPref: (pref: ThemePreference) => void;
}

export const useThemePreference = create<PrefState>((set) => ({
  pref: 'system',
  setPref: (pref) => {
    set({ pref });
    void AsyncStorage.setItem(PREF_KEY, pref).catch(() => undefined);
  },
}));

/** Reads the saved choice once at start. */
export async function loadThemePreference(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(PREF_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') useThemePreference.setState({ pref: saved });
  } catch {
    // Keep 'system'.
  }
}

export interface Theme {
  colors: Palette;
  dark: boolean;
  /** UI language is English (Source Serif faces, LTR copy). */
  english: boolean;
  /** Layout direction of the app (I18nManager). */
  rtl: boolean;
  /** How faint the page-edge arabesque is (site-public.css `--decor-opacity`: 0.065 light, 0.12 dark). */
  decorOpacity: number;
  font: (weight?: FontWeightName) => string;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const pref = useThemePreference((s) => s.pref);
  const { i18n } = useTranslation();
  const english = i18n.language === 'en';
  const isDark = pref === 'system' ? system === 'dark' : pref === 'dark';
  const theme = useMemo<Theme>(
    () => ({
      colors: isDark ? dark : light,
      dark: isDark,
      english,
      rtl: I18nManager.isRTL,
      decorOpacity: isDark ? 0.12 : 0.065,
      font: (weight = 'regular') => uiFont(weight, english),
    }),
    [isDark, english],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme outside ThemeProvider');
  return theme;
}

/** `const styles = useStyles(makeStyles)` with `makeStyles = (t: Theme) => ({ … })` defined outside the component. */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
}

/** Keeps the saved preference in memory once loaded. */
export function useLoadThemePreference(): void {
  useEffect(() => {
    void loadThemePreference();
  }, []);
}

export { dark, light, type Palette } from './palette';
export { FontFiles, QURAN_FONT, WORDMARK_FONT } from './fonts';

/** The website's spacing and radii (site-public.css / Tailwind) in dp. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40 } as const;
export const radius = {
  /** Buttons and inputs (`.solid-button`, `.outline-button`: 7px). */
  control: 7,
  /** Option cards and list cards (14px). */
  card: 14,
  /** Pathway and featured cards (12px). */
  panel: 12,
  /** Quote card (`rounded-[1.35rem]`). */
  quote: 21.6,
  full: 999,
} as const;
/** Gutter of the site at phone width. */
export const GUTTER = 20;
