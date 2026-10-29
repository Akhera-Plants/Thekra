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
    // Native accents (system dialog buttons, text selection) in the website's primary.
    primaryColor: '#326C59',
    // The launcher name in Arabic on Arabic devices («ذكرى»); «Thekra» elsewhere.
    locales: { ar: './locales/ar.json' },
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
      // The website's mark (frontend/src/app/icon.svg), rendered to assets/*icon*.png.
      adaptiveIcon: {
        backgroundColor: '#326C59',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      // expo-screen-capture's manifest asks for photo access to detect screenshots; the app only blocks them
      // (FLAG_SECURE on the sin-program page), so the photo permissions are removed from the build.
      blockedPermissions: ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.READ_MEDIA_IMAGES'],
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
          imageWidth: 96,
          // The website's page colour in each theme, so the first frame matches the app behind it.
          backgroundColor: '#fffcf9',
          dark: { backgroundColor: '#101010' },
          resizeMode: 'contain',
        },
      ],
      'expo-secure-store',
      'expo-localization',
      // The optional lock on a private page. Generic on purpose: it never says what the page holds.
      // Arabic devices read the Arabic line from locales/ar.json.
      [
        'expo-local-authentication',
        { faceIDPermission: 'Thekra uses Face ID to unlock the private pages you choose to lock.' },
      ],
      '@react-native-community/datetimepicker',
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
