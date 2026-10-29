import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config.
 * - `runtimeVersion` follows appVersion so OTA updates stay binary-compatible.
 * - `updates.url` is set only when `EAS_PROJECT_ID` is present, so Expo Go /
 *   local `expo start` still work without an EAS project.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID?.trim();

  return {
    ...config,
    name: 'Thekra',
    slug: 'thekra',
    version: '0.1.0',
    scheme: 'thekra',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: projectId
      ? {
          url: `https://u.expo.dev/${projectId}`,
        }
      : {
          // Local / Expo Go: no OTA endpoint. Channel wiring lives in eas.json.
          enabled: false,
        },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.thekra.app',
    },
    android: {
      package: 'com.thekra.app',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          // Android's generated styles always point at `splashscreen_logo`; without an image the release build fails
          // («resource drawable/splashscreen_logo not found»).
          image: './assets/splash-icon.png',
          imageWidth: 200,
          backgroundColor: '#1B6CA8',
          resizeMode: 'contain',
        },
      ],
      'expo-secure-store',
      'expo-localization',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      apiUrl:
        process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:3001',
      eas: projectId ? { projectId } : undefined,
    },
  };
};
