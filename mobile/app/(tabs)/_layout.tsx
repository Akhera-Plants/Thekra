/**
 * Bottom tab bar: Home · My habits · Browse · Favorites · Settings, in the website's look (background fill,
 * hairline on top, thin lucide icons, Plex labels, the primary colour for the current tab).
 */

import React from 'react';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookOpen, House, Settings2, Sprout, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme';

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const c = theme.colors;
  const icon = (Glyph: LucideIcon) =>
    function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
      return <Glyph size={23} color={color as string} strokeWidth={focused ? 1.8 : 1.4} absoluteStrokeWidth />;
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
          height: 66,
          paddingTop: 6,
          paddingBottom: 8,
          elevation: 0,
        },
        tabBarLabelStyle: { fontFamily: theme.font('medium'), fontSize: 12 },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon(House) }} />
      <Tabs.Screen name="habits" options={{ title: t('tabs.habits'), tabBarIcon: icon(Sprout) }} />
      <Tabs.Screen name="browse" options={{ title: t('tabs.browse'), tabBarIcon: icon(BookOpen) }} />
      <Tabs.Screen name="favorites" options={{ title: t('tabs.favorites'), tabBarIcon: icon(Bookmark) }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: icon(Settings2) }} />
    </Tabs>
  );
}
