/**
 * Root layout — providers: QueryClient + persister, i18n, RTL bootstrap, Arabic font.
 * This is the first file expo-router mounts.
 */

// First: `globalThis.crypto.getRandomValues` from expo-crypto, before practice-core's vault can run (Hermes).
import '@/lib/crypto/install';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { onlineManager } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import {
  createQueryClient,
  asyncStoragePersister,
  shouldPersistQuery,
  MAX_AGE,
} from '@/lib/query-client';
import { initI18n, detectDeviceLocale, switchDirectionIfNeeded, type SupportedLocale } from '@/lib/i18n';
import i18n from '@/lib/i18n';
import { setApiLocale } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { dark, FontFiles, light, loadThemePreference, radius, ThemeProvider, useTheme } from '@/theme';
import { usePracticeLifecycle } from '@/lib/practice/use-practice-lifecycle';
import { useStackScreenOptions } from '@/ui';

// A deep link or a reminder tap that cold-starts the app lands on its screen with the tabs under it, so Back works.
export const unstable_settings = { anchor: '(tabs)' };

// Keep splash visible until fonts + bootstrap finish.
void SplashScreen.preventAutoHideAsync();

const LOCALE_STORAGE_KEY = 'thekra_locale';

/**
 * «التفسير» / «الشرح» opens over the page as a native form sheet: UIKit's sheet on iOS (grabber, detents), Material's
 * BottomSheetBehavior on Android (react-native-screens 4.26). It opens at 60% and pulls up to full height; its own top
 * row has the title and close (SheetScreen), so the native header is off.
 */
const STUDY_SHEET = {
  presentation: 'formSheet' as const,
  headerShown: false,
  sheetAllowedDetents: [0.6, 1],
  sheetGrabberVisible: true,
  sheetCornerRadius: radius.quote,
};

const queryClient = createQueryClient();

onlineManager.setEventListener((setOnline) => {
  const unsub = NetInfo.addEventListener((state) => {
    setOnline(state.isConnected ?? true);
  });
  return unsub;
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const rehydrate = useAuthStore((s) => s.rehydrate);

  const systemScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(FontFiles);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;

    async function bootstrap() {
      let locale: SupportedLocale;
      try {
        const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        locale = (stored as SupportedLocale) ?? detectDeviceLocale();
      } catch {
        locale = detectDeviceLocale();
      }

      initI18n(locale);

      // Still behind the splash: a direction change reloads now, invisibly, instead of asking for a restart.
      if (await switchDirectionIfNeeded(locale)) return;

      setApiLocale(locale === 'ar' ? 'ar' : 'en');
      await loadThemePreference();
      await rehydrate();
      setReady(true);
      await SplashScreen.hideAsync();
    }

    void bootstrap();
  }, [fontsLoaded, fontError, rehydrate]);

  if (!ready) {
    // Before the theme provider: the system scheme; `link` is primary in light and the readable ring in dark.
    const bootColors = systemScheme === 'dark' ? dark : light;
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bootColors.background,
        }}
      >
        <ActivityIndicator color={bootColors.link} />
      </View>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: MAX_AGE,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            shouldPersistQuery(query.queryKey as readonly unknown[]),
        },
      }}
    >
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <ThemedShell />
        </ThemeProvider>
      </I18nextProvider>
    </PersistQueryClientProvider>
  );
}

/** Navigation and status bar in the app theme (no white flash between screens in dark mode). */
function ThemedShell() {
  const theme = useTheme();
  const stackOptions = useStackScreenOptions();
  const c = theme.colors;
  const base = theme.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    dark: theme.dark,
    colors: { ...base.colors, primary: c.primary, background: c.background, card: c.background, text: c.foreground, border: c.border, notification: c.destructive },
  };
  return (
    <NavigationThemeProvider value={navTheme}>
      {/* Pushed screens get the native header (system Back); tabs, the practice stack and auth own theirs. */}
      <Stack screenOptions={stackOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="practice" options={{ headerShown: false }} />
        <Stack.Screen name="circles" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="quotes/study/[id]" options={STUDY_SHEET} />
      </Stack>
      <PracticeLifecycle />
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

/** Background work of the practice feature (store, local reminders, account sync). Renders nothing. */
function PracticeLifecycle() {
  usePracticeLifecycle();
  return null;
}
