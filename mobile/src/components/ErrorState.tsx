import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{message ?? t('common.error')}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          style={styles.retryBtn}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['8'],
    gap: Spacing['4'],
  },
  icon: {
    fontSize: 48,
  },
  message: {
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing['6'],
    paddingVertical: Spacing['3'],
    borderRadius: Radius.md,
  },
  retryText: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});
