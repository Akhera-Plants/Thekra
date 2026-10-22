/**
 * Root layout — providers: QueryClient + persister, i18n, RTL bootstrap, Arabic font.
 * This is the first file expo-router mounts.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Stack } from 'expo-router';
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
import { initI18n, detectDeviceLocale, applyRtlIfNeeded, type SupportedLocale } from '@/lib/i18n';
import i18n from '@/lib/i18n';
import { setApiLocale } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Colors, FontFamily } from '@/lib/tokens';

// Keep splash visible until fonts + bootstrap finish.
void SplashScreen.preventAutoHideAsync();

const LOCALE_STORAGE_KEY = 'thekra_locale';
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

  const [fontsLoaded, fontError] = useFonts({
    [FontFamily.arabic]: require('../assets/fonts/NotoNaskhArabic-Regular.ttf'),
  });

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

      const directionChanged = applyRtlIfNeeded(locale);
      if (directionChanged) {
        Alert.alert(
          locale === 'ar' ? 'يتطلب إعادة التشغيل' : 'Restart required',
          locale === 'ar'
            ? 'سيُطبَّق تغيير اتجاه اللغة بعد إعادة تشغيل التطبيق.'
            : 'Language direction change will take effect after restarting the app.',
        );
      }

      setApiLocale(locale === 'ar' ? 'ar' : 'en');
      await rehydrate();
      setReady(true);
      await SplashScreen.hideAsync();
    }

    void bootstrap();
  }, [fontsLoaded, fontError, rehydrate]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Colors.background,
        }}
      >
        <ActivityIndicator color={Colors.primary} />
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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sins" options={{ headerShown: false }} />
          <Stack.Screen name="good-deeds" options={{ headerShown: false }} />
          <Stack.Screen name="quotes" options={{ headerShown: false }} />
          <Stack.Screen name="feelings" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </I18nextProvider>
    </PersistQueryClientProvider>
  );
}
