/**
 * Home screen — two primary entry points phrased as moments.
 * Guest-first: no sign-in required.
 * mobile-plan §3 (Home screen).
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/lib/tokens';

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>{t('home.title')}</Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
        </View>

        {/* Entry action: Sin */}
        <TouchableOpacity
          style={[styles.actionCard, styles.sinCard]}
          onPress={() => router.push('/sins')}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Text style={styles.actionEmoji}>🛑</Text>
          <View style={styles.actionText}>
            <Text style={[styles.actionTitle, styles.sinTitle]}>
              {t('home.sinAction')}
            </Text>
            <Text style={styles.actionSubtitle}>
              {t('home.sinSubtitle')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Entry action: Good deed */}
        <TouchableOpacity
          style={[styles.actionCard, styles.deedCard]}
          onPress={() => router.push('/good-deeds')}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Text style={styles.actionEmoji}>✨</Text>
          <View style={styles.actionText}>
            <Text style={[styles.actionTitle, styles.deedTitle]}>
              {t('home.goodDeedAction')}
            </Text>
            <Text style={styles.actionSubtitle}>
              {t('home.goodDeedSubtitle')}
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    padding: Spacing['6'],
    gap: Spacing['5'],
  },
  header: {
    marginBottom: Spacing['4'],
    alignItems: 'center',
    paddingTop: Spacing['8'],
  },
  appTitle: {
    fontSize: FontSize['4xl'],
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing['2'],
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing['6'],
    borderRadius: Radius.xl,
    gap: Spacing['4'],
    ...Shadow.md,
  },
  sinCard: {
    backgroundColor: Colors.intentSinLight,
    borderWidth: 1.5,
    borderColor: Colors.intentSin,
  },
  deedCard: {
    backgroundColor: Colors.intentGoodDeedLight,
    borderWidth: 1.5,
    borderColor: Colors.intentGoodDeed,
  },
  actionEmoji: {
    fontSize: 40,
  },
  actionText: {
    flex: 1,
    gap: Spacing['1'],
  },
  actionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    textAlign: 'right',
  },
  sinTitle: {
    color: Colors.intentSin,
  },
  deedTitle: {
    color: Colors.intentGoodDeed,
  },
  actionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'right',
  },
});
