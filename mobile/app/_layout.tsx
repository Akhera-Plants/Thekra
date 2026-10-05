/**
 * Root layout — providers: QueryClient + persister, i18n, RTL bootstrap.
 * This is the first file expo-router mounts.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { I18nextProvider } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

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
import { Colors } from '@/lib/tokens';

const LOCALE_STORAGE_KEY = 'thekra_locale';
const queryClient = createQueryClient();

// Wire NetInfo into TanStack Query's online manager
onlineManager.setEventListener((setOnline) => {
  const unsub = NetInfo.addEventListener((state) => {
    setOnline(state.isConnected ?? true);
  });
  return unsub;
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const rehydrate = useAuthStore((s) => s.rehydrate);

  useEffect(() => {
    async function bootstrap() {
      // 1. Restore saved locale (or detect from device)
      let locale: SupportedLocale;
      try {
        const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        locale = (stored as SupportedLocale) ?? detectDeviceLocale();
      } catch {
        locale = detectDeviceLocale();
      }

      // 2. Init i18n with the resolved locale
      initI18n(locale);

      // 3. Apply RTL direction
      const directionChanged = applyRtlIfNeeded(locale);
      if (directionChanged) {
        // Direction changed — prompt for restart
        Alert.alert(
          locale === 'ar' ? 'يتطلب إعادة التشغيل' : 'Restart required',
          locale === 'ar'
            ? 'سيُطبَّق تغيير اتجاه اللغة بعد إعادة تشغيل التطبيق.'
            : 'Language direction change will take effect after restarting the app.',
        );
      }

      // 4. Sync locale with API client
      setApiLocale(locale === 'ar' ? 'ar' : 'en');

      // 5. Rehydrate auth session (reads refresh token from SecureStore)
      await rehydrate();

      setReady(true);
    }

    void bootstrap();
  }, [rehydrate]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
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
