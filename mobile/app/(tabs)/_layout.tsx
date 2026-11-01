/**
 * Bottom tab bar, four tabs: «الرئيسية» · «ورد اليوم» · «عاداتي» · «الإعدادات» (the middle two for members only), in
 * reading order (Home at the start: the right in Arabic, the left in English), in the website's look (background
 * fill, hairline on top, thin lucide icons, Plex labels, the primary colour for the current tab). The current tab's
 * icon sits in a soft green pill; the others have none (`tabIconLook`, the same rule for every tab). «عاداتي» is the
 * `record` route (the name kept so older links work). The other screens (أعمال دورية، المحفوظات، مواسم الخير،
 * استكشف النصوص…) open from the side menu in the app header.
 *
 * Height and bottom padding add the safe-area inset (home indicator, Android's edge-to-edge navigation bar): the tab
 * bar uses a custom height as is, so the inset has to be in it.
 */

import React from 'react';
import { View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, ListChecks, Settings2, Sprout, type LucideIcon } from 'lucide-react-native';
import { isSignedIn, openSignIn } from '@/lib/auth/require-sign-in';
import { TAB_PILL, tabIconLook } from '@/lib/nav/tab-bar';
import { radius, useTheme } from '@/theme';

/**
 * Tab bar height above the safe-area inset: the 28-high pill every tab reserves, the 12 label on its own line, and the
 * paddings (62 squeezed the label once every tab had the pill box).
 */
const TAB_BAR_BASE_HEIGHT = 68;
const TAB_BAR_PADDING = 6;
const ICON_SIZE = 23;

interface ITabIconProps {
  color: ColorValue;
  focused: boolean;
}

/** One tab icon: the glyph, in a soft pill when its tab is current. */
function TabGlyph({ glyph: Glyph, color, focused }: ITabIconProps & { glyph: LucideIcon }) {
  const { colors } = useTheme();
  const look = tabIconLook(focused, colors);
  return (
    <View style={{ ...TAB_PILL, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: look.pill }}>
      <Glyph size={ICON_SIZE} color={color as string} strokeWidth={look.strokeWidth} absoluteStrokeWidth />
    </View>
  );
}

const icon = (glyph: LucideIcon) =>
  function TabIcon(props: ITabIconProps) {
    return <TabGlyph glyph={glyph} {...props} />;
  };

const HomeIcon = icon(House);
const WirdIcon = icon(Sprout);
const RecordIcon = icon(ListChecks);
const SettingsIcon = icon(Settings2);

/** «ورد اليوم» and «عاداتي» are for members: a guest's tap opens «تسجيل الدخول», then the tab (owner, 2026-11-01). */
const membersOnly = (next: string) => ({
  tabPress: (event: { preventDefault: () => void }) => {
    if (isSignedIn()) return;
    event.preventDefault();
    openSignIn(next);
  },
});

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

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
        tabBarIconStyle: TAB_PILL,
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: HomeIcon }} />
      <Tabs.Screen
        name="habits"
        options={{ title: t('tabs.wird'), tabBarIcon: WirdIcon }}
        listeners={membersOnly('/(tabs)/habits')}
      />
      <Tabs.Screen
        name="record"
        options={{ title: t('tabs.record'), tabBarIcon: RecordIcon }}
        listeners={membersOnly('/(tabs)/record')}
      />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: SettingsIcon }} />
    </Tabs>
  );
}
