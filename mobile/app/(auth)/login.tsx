/**
 * Login: optional account, reachable only from Favorites or Settings (mobile-plan §3). Guest-first: every guest
 * flow works without signing in. After the website's login page: the title, one quiet line, email and password
 * (labels above, autofill as a sign-in pair), one full-width action, then the way to register. Failures show
 * inline in the app's language, never the raw API text.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { leaveAuth } from '@/lib/auth/require-sign-in';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ApiError } from '@/lib/types/api';
import { space, useStyles } from '@/theme';
import { Button, ErrorText, Field, PageHeader, Screen, Text, TextLink } from '@/ui';
import type { SignInWhy } from '@/lib/auth/require-sign-in';

const makeStyles = () => ({
  form: { gap: space.lg },
  ltr: { writingDirection: 'ltr' as const },
  switch: { gap: space.xs },
});

export default function LoginScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const clearError = useAuthStore((s) => s.clearError);

  const { next, why, email: carried } = useLocalSearchParams<{ next?: string; why?: SignInWhy; email?: string }>();
  const [email, setEmail] = useState(typeof carried === 'string' ? carried : '');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleLogin() {
    if (!email || !password) return;
    clearError();
    setFailure(null);
    try {
      await login({ email, password });
      leaveAuth(next);
    } catch (e) {
      const offline = e instanceof ApiError && (e.status === 0 || e.code === 'NETWORK_ERROR');
      setFailure(offline ? t('errors.network') : t('auth.loginError'));
    }
  }

  return (
      <Screen edges={['bottom']} keyboard>
        <PageHeader title={t('auth.loginTitle')} lead={why ? t(`auth.why.${why}`) : t('auth.guestNote')} />
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
            textContentType="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => void handleLogin()}
            style={styles.ltr}
          />
          {failure ? <ErrorText>{failure}</ErrorText> : null}
          <Button
            label={t('auth.loginButton')}
            onPress={() => void handleLogin()}
            disabled={!canSubmit}
            loading={isLoading}
            block
            size="lg"
          />
          {/* A disabled button says why (owner round 8, item 2). */}
          {!canSubmit ? (
            <Text variant="caption" tone="muted">
              {t('auth.loginFill')}
            </Text>
          ) : null}
        </View>
        <View style={styles.switch}>
          <Text variant="small" tone="muted">
            {t('auth.noAccount')}
          </Text>
          <TextLink label={t('auth.register')} onPress={() => router.replace({ pathname: '/(auth)/register', params: { ...(next ? { next } : {}), ...(why ? { why } : {}) } })} />
        </View>
      </Screen>
  );
}
