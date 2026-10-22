import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing } from '@/lib/tokens';

interface EmptyStateProps {
  message: string;
  hint?: string;
  icon?: string;
}

export function EmptyState({ message, hint, icon = '📭' }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
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
    fontWeight: '500',
  },
  hint: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
