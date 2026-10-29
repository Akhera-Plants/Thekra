/**
 * i18n setup for Thekra mobile.
 *
 * Uses i18next + react-i18next + expo-localization.
 * Arabic is the default and primary language.
 *
 * RTL note (mobile-plan.md §4):
 *  - I18nManager.forceRTL(true) requires an app reload to fully take effect.
 *  - Call applyRtlIfNeeded() on app init and on locale change.
 *  - After a locale change that changes RTL direction, prompt the user to restart.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import { reloadAppAsync } from 'expo';
import * as Localization from 'expo-localization';

import ar from './ar.json';
import en from './en.json';

export type SupportedLocale = 'ar' | 'en';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['ar', 'en'];
export const DEFAULT_LOCALE: SupportedLocale = 'ar';

// ── RTL ───────────────────────────────────────────────────────────────────────

export function isRTLLocale(locale: SupportedLocale): boolean {
  return locale === 'ar';
}

/**
 * Apply RTL/LTR direction for the given locale.
 * Returns true if the direction changed (app restart required).
 */
export function applyRtlIfNeeded(locale: SupportedLocale): boolean {
  const shouldBeRTL = isRTLLocale(locale);
  const currentlyRTL = I18nManager.isRTL;

  if (shouldBeRTL !== currentlyRTL) {
    I18nManager.forceRTL(shouldBeRTL);
    return true; // direction changed — caller should prompt restart
  }
  return false;
}

/**
 * Sets the layout direction for `locale` and, when it changed, reloads the JS app at once so every screen
 * lays out in the new direction (React Native reads I18nManager only at start). No restart prompt.
 * Resolves false when nothing changed; when it changed the app reloads and the promise may never settle.
 */
export async function switchDirectionIfNeeded(locale: SupportedLocale): Promise<boolean> {
  I18nManager.allowRTL(true);
  if (!applyRtlIfNeeded(locale)) return false;
  await reloadAppAsync();
  return true;
}

// ── Locale detection ──────────────────────────────────────────────────────────

/**
 * Detect the best initial locale from the device.
 * Falls back to DEFAULT_LOCALE if no match.
 */
export function detectDeviceLocale(): SupportedLocale {
  const deviceLocales = Localization.getLocales?.() ?? [];
  for (const localeInfo of deviceLocales) {
    const lang = localeInfo.languageCode as SupportedLocale;
    if (SUPPORTED_LOCALES.includes(lang)) {
      return lang;
    }
  }
  return DEFAULT_LOCALE;
}

// ── i18next init ──────────────────────────────────────────────────────────────

export function initI18n(locale: SupportedLocale = DEFAULT_LOCALE): void {
  if (i18n.isInitialized) return;

  void i18n
    .use(initReactI18next)
    .init({
      resources: {
        ar: { translation: ar },
        en: { translation: en },
      },
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      interpolation: {
        escapeValue: false,
      },
      compatibilityJSON: 'v4',
    });

  // Apply RTL on initial load
  applyRtlIfNeeded(locale);
}

export { i18n };
export default i18n;
