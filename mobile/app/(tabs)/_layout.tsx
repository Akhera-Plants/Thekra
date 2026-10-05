/**
 * Bottom tab bar layout.
 * Tabs: Home · Browse · Favorites · Settings
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/lib/tokens';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabIconSelected,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        tabBarStyle: {
          borderTopColor: Colors.border,
          backgroundColor: Colors.background,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => (
            <TabIcon label="🏠" color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: t('tabs.browse'),
          tabBarIcon: ({ color }) => (
            <TabIcon label="📖" color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t('tabs.favorites'),
          tabBarIcon: ({ color }) => (
            <TabIcon label="★" color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => (
            <TabIcon label="⚙️" color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ label, color }: { label: string; color: string }) {
  // Phase 8: replace emoji with bundled icon set (lucide-react-native or similar)
  const { Text } = require('react-native') as typeof import('react-native');
  return <Text style={{ fontSize: 20, color }}>{label}</Text>;
}
