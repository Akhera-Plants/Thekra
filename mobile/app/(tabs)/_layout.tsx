/**
 * Bottom tab bar: Home · My garden · My habits (centre) · Favorites · Settings, in reading order (Home at the start:
 * the right in Arabic, the left in English), in the website's look (background fill, hairline on top, thin lucide
 * icons, Plex labels, the primary colour for the current tab). «عاداتي» is the centre of the app, so its icon sits in
 * a soft pill, stronger when it is the current tab. Texts browsing lives on the home page («استكشف النصوص»).
 *
 * Height and bottom padding add the safe-area inset (home indicator, Android's edge-to-edge navigation bar): the tab
 * bar uses a custom height as is, so the inset has to be in it.
 */

import React from 'react';
import { View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bookmark, Flower2, House, Settings2, Sprout, type LucideIcon } from 'lucide-react-native';
import { radius, useTheme } from '@/theme';

/** Tab bar height above the safe-area inset. */
const TAB_BAR_BASE_HEIGHT = 62;
const TAB_BAR_PADDING = 6;
const ICON_SIZE = 23;
const CENTER_PILL = { width: 54, height: 30 } as const;

interface ITabIconProps {
  color: ColorValue;
  focused: boolean;
}

/** «عاداتي»: the sprout in a soft pill (sage when current, the quiet surface otherwise). */
function CenterTabIcon({ color, focused }: ITabIconProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        ...CENTER_PILL,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.primarySoft : colors.muted,
      }}
    >
      <Sprout size={ICON_SIZE} color={color as string} strokeWidth={focused ? 1.8 : 1.5} absoluteStrokeWidth />
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;
  const icon = (Glyph: LucideIcon) =>
    function TabIcon({ color, focused }: ITabIconProps) {
      return <Glyph size={ICON_SIZE} color={color as string} strokeWidth={focused ? 1.8 : 1.4} absoluteStrokeWidth />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.dark ? c.ring : c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingTop: TAB_BAR_PADDING,
          paddingBottom: insets.bottom + TAB_BAR_PADDING,
          elevation: 0,
        },
        tabBarLabelStyle: { fontFamily: theme.font('medium'), fontSize: 12 },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon(House) }} />
      <Tabs.Screen name="garden" options={{ title: t('tabs.garden'), tabBarIcon: icon(Flower2) }} />
      <Tabs.Screen
        name="habits"
        options={{ title: t('tabs.habits'), tabBarIcon: CenterTabIcon, tabBarIconStyle: CENTER_PILL }}
      />
      <Tabs.Screen name="favorites" options={{ title: t('tabs.favorites'), tabBarIcon: icon(Bookmark) }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: icon(Settings2) }} />
    </Tabs>
  );
}
