/**
 * Register: optional account creation (mobile-plan §3), reached from the login screen. Same block as login:
 * the title, one quiet line, the name (required, owner 2026-11-01), email and a new password (autofill offers a strong password and saves the pair),
 * one full-width action with the privacy policy (the site) under it, then the way back to sign in. Failures show inline, never the raw API text.
 */

import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { leaveAuth } from '@/lib/auth/require-sign-in';
import { onboardingSeen } from '@/lib/practice/onboarding-flag';
import { useTranslation } from 'react-i18next';
import { SITE_PRIVACY_PATH, sitePageUrl } from '@/lib/site';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ApiError } from '@/lib/types/api';
import { space, useStyles } from '@/theme';
import { Button, ErrorText, Field, PageHeader, Screen, Text, TextLink } from '@/ui';
import type { SignInWhy } from '@/lib/auth/require-sign-in';

/** The API's rule (backend register.dto): at least 10 characters. */
const PASSWORD_MIN = 10;

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

  const [name, setName] = useState('');
  const { next, why } = useLocalSearchParams<{ next?: string; why?: SignInWhy }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length > 0;

  async function handleRegister() {
    if (!canSubmit) return;
    clearError();
    setFailure(null);
    setTaken(false);
    // The rule is checked here first, so a short password never reaches the server and the person is told which rule.
    if (password.length < PASSWORD_MIN) {
      setPasswordError(t('auth.passwordMin'));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFailure(t('auth.emailInvalid'));
      return;
    }
    try {
      await register({ email, password, displayName: name.trim() });
      // A new account sees the first steps once (owner round 5, F-26 a); they end in «عاداتي» or on home.
      if (await onboardingSeen()) leaveAuth(next);
      else router.replace('/practice/onboarding');
    } catch (e) {
      const offline = e instanceof ApiError && (e.status === 0 || e.code === 'NETWORK_ERROR');
      const isTaken = e instanceof ApiError && e.code === 'EMAIL_ALREADY_REGISTERED';
      const weak = e instanceof ApiError && Array.isArray(e.details) && e.details.some((d) => d.field === 'password');
      if (weak) setPasswordError(t('auth.passwordMin'));
      else if (isTaken) setTaken(true);
      else setFailure(offline ? t('errors.network') : t('auth.registerError'));
    }
  }

  return (
      <Screen edges={['bottom']} keyboard>
        <PageHeader title={t('auth.registerTitle')} lead={why ? t(`auth.why.${why}`) : t('auth.guestNote')} />
        <View style={styles.form}>
          <Field
            label={t('auth.name')}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setFailure(null);
            }}
            textContentType="name"
            autoComplete="name"
            maxLength={80}
          />
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setFailure(null);
              setTaken(false);
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
            hint={t('auth.passwordHint')}
            error={passwordError}
            onChangeText={(v) => {
              setPassword(v);
              setFailure(null);
              setPasswordError(null);
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
          {taken ? (
            <View style={styles.switch}>
              <ErrorText>{t('auth.emailTaken')}</ErrorText>
              <Button
                label={t('auth.signInNow')}
                variant="outline"
                onPress={() => router.replace({ pathname: '/(auth)/login', params: { email: email.trim(), ...(next ? { next } : {}), ...(why ? { why } : {}) } })}
              />
            </View>
          ) : null}
          <Button
            label={t('auth.registerButton')}
            onPress={() => void handleRegister()}
            disabled={!canSubmit}
            loading={isLoading}
            block
            size="lg"
          />
          {!canSubmit ? (
            <Text variant="caption" tone="muted">
              {t('auth.registerFill')}
            </Text>
          ) : null}
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
          <TextLink label={t('auth.login')} onPress={() => router.replace({ pathname: '/(auth)/login', params: { ...(next ? { next } : {}), ...(why ? { why } : {}) } })} />
        </View>
      </Screen>
  );
}
