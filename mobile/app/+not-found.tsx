import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔍</Text>
      <Text style={styles.title}>{t('common.notFound')}</Text>
      <Link href="/" asChild>
        <TouchableOpacity style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: Spacing['6'],
    padding: Spacing['8'],
  },
  icon: { fontSize: 64 },
  title: {
    fontSize: FontSize['2xl'],
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  btn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing['8'],
    paddingVertical: Spacing['4'],
    borderRadius: Radius.md,
  },
  btnText: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});
