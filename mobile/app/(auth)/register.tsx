/**
 * Register screen — optional account creation.
 * mobile-plan §3 (Login/Register).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleRegister() {
    if (!email || !password) return;
    clearError();
    try {
      await register({ email, password });
      router.back();
    } catch {
      // error is displayed from store
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Close */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t('auth.registerTitle')}</Text>

          {/* Guest note */}
          <View style={styles.guestNote}>
            <Text style={styles.guestNoteText}>{t('auth.guestNote')}</Text>
          </View>

          {/* Error */}
          {storeError && (
            <Text style={styles.errorText}>{storeError}</Text>
          )}

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              textAlign="left"
              accessibilityLabel={t('auth.email')}
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={() => void handleRegister()}
              textAlign="left"
              accessibilityLabel={t('auth.password')}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={() => void handleRegister()}
            disabled={isLoading}
            accessibilityRole="button"
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={styles.submitBtnText}>{t('auth.registerButton')}</Text>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('auth.haveAccount')}</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity accessibilityRole="link">
                <Text style={styles.switchLink}>{t('auth.login')}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  kav: { flex: 1 },
  scroll: { padding: Spacing['6'], gap: Spacing['5'] },
  closeBtn: { alignSelf: 'flex-end', padding: Spacing['2'] },
  closeBtnText: { fontSize: FontSize.xl, color: Colors.textMuted },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
  },
  guestNote: {
    padding: Spacing['4'],
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
  },
  guestNoteText: { fontSize: FontSize.sm, color: Colors.primary, textAlign: 'center' },
  errorText: { color: Colors.error, fontSize: FontSize.sm, textAlign: 'center' },
  field: { gap: Spacing['2'] },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['3'],
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    padding: Spacing['4'],
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing['2'],
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing['2'],
  },
  switchText: { fontSize: FontSize.sm, color: Colors.textMuted },
  switchLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
});
