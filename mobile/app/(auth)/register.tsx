/**
 * Register: optional account creation (mobile-plan §3), reached from the login screen. Same block as login:
 * the title, one quiet line, email and a new password (autofill offers a strong password and saves the pair),
 * one full-width action with the privacy policy (the site) under it, then the way back to sign in. Failures show inline, never the raw API text.
 */

import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SITE_PRIVACY_PATH, sitePageUrl } from '@/lib/site';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ApiError } from '@/lib/types/api';
import { space, useStyles } from '@/theme';
import { Button, ErrorText, Field, PageHeader, Screen, Text, TextLink } from '@/ui';

const makeStyles = () => ({
  form: { gap: space.lg },
  ltr: { writingDirection: 'ltr' as const },
  switch: { gap: space.xs },
});

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleRegister() {
    if (!email || !password) return;
    clearError();
    setFailure(null);
    try {
      await register({ email, password });
      router.back();
    } catch (e) {
      const offline = e instanceof ApiError && (e.status === 0 || e.code === 'NETWORK_ERROR');
      setFailure(offline ? t('errors.network') : t('auth.registerError'));
    }
  }

  return (
      <Screen edges={['bottom']} keyboard>
        <PageHeader title={t('auth.registerTitle')} lead={t('auth.guestNote')} />
        <View style={styles.form}>
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setFailure(null);
            }}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.ltr}
          />
          <Field
            label={t('auth.password')}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setFailure(null);
            }}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => void handleRegister()}
            style={styles.ltr}
          />
          {failure ? <ErrorText>{failure}</ErrorText> : null}
          <Button
            label={t('auth.registerButton')}
            onPress={() => void handleRegister()}
            disabled={!canSubmit}
            loading={isLoading}
            block
            large
          />
          <TextLink
            label={t('settings.privacyPolicy')}
            muted
            onPress={() => void Linking.openURL(sitePageUrl(SITE_PRIVACY_PATH, i18n.language)).catch(() => undefined)}
          />
        </View>
        <View style={styles.switch}>
          <Text variant="small" tone="muted">
            {t('auth.haveAccount')}
          </Text>
          <TextLink label={t('auth.login')} onPress={() => router.replace('/(auth)/login')} />
        </View>
      </Screen>
  );
}
