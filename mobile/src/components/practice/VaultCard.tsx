/**
 * «احفظ البرنامج مشفّرًا في حسابك» (sync contract §1, §4), after the website's VaultPanel: one bordered box with a
 * lock icon and a title. Set a «رمز الخصوصية» (long and hard to guess per practice-core `privacyCodeProblem`, typed twice, with the warning that it cannot be
 * recovered and nobody can read the program without it), unlock on another device, and the optional «تذكّر على
 * هذا الجهاز» (off by default; the key goes to expo-secure-store). Shown only when signed in; a guest sees
 * `VaultSignInNote` instead. The code never leaves this component except into practice-core's key derivation,
 * and its inputs refuse autofill and password managers (no textContentType, no autoComplete).
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyRound, LockKeyhole, LockKeyholeOpen, type LucideIcon } from 'lucide-react-native';
import { privacyCodeProblem } from '@thekra/practice-core';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { enableVault, refreshVault, setRememberKey, unlockWithCode, useVaultState } from '@/lib/practice/vault-runner';
import { space, useStyles, useTheme } from '@/theme';
import { Button, Card, ErrorText, Field, Icon, NextStep, Row, SwitchRow, Text, TextLink } from '@/ui';

/** i18n key under `vault.errors` for a new code, or null when it can be used (practice-core `privacyCodeProblem`). */
export function validateNewCode(code: string, confirm: string): 'tooShort' | 'weak' | 'mismatch' | null {
  const problem = privacyCodeProblem(code);
  if (problem === 'short') return 'tooShort';
  if (problem === 'weak') return 'weak';
  if (code !== confirm) return 'mismatch';
  return null;
}

const makeStyles = () => ({
  title: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  titleText: { flex: 1 },
  actions: { flexWrap: 'wrap' as const, gap: space.md },
});

interface VaultBoxProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}

/** The site's vault box: card fill, hairline, the lock icon in primary before the title. */
function VaultBox({ icon, title, children }: VaultBoxProps) {
  const styles = useStyles(makeStyles);
  return (
    <Card>
      <View style={styles.title}>
        <Icon icon={icon} tone="link" />
        <Text variant="heading" accessibilityRole="header" style={styles.titleText}>
          {title}
        </Text>
      </View>
      {children}
    </Card>
  );
}

/** Guest: the program stays on this device; signing in allows the encrypted copy (website `vault.guest`). */
export function VaultSignInNote() {
  const { t } = useTranslation();
  return (
    <VaultBox icon={LockKeyhole} title={t('vault.title')}>
      <Text variant="small" tone="muted">
        {t('vault.signInHint')}
      </Text>
      <TextLink label={t('auth.loginTitle')} onPress={() => router.push('/(auth)/login')} />
    </VaultBox>
  );
}

interface CodeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** A privacy-code input: hidden, no autofill, no suggestions, no password-manager save prompt. */
function CodeField({ label, value, onChange }: CodeFieldProps) {
  return (
    <Field
      label={label}
      value={value}
      onChangeText={onChange}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      textContentType="none"
      importantForAutofill="no"
    />
  );
}

interface VaultCardProps {
  userId: string;
  hasProgram: boolean;
}

export function VaultCard({ userId, hasProgram }: VaultCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const status = useVaultState((s) => s.status);
  const remember = usePracticeStore((s) => s.prefs.rememberVaultKey);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unknown') void refreshVault(userId);
  }, [status, userId]);

  function reset() {
    setCode('');
    setConfirm('');
    setOpen(false);
  }

  function editCode(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setError(null);
    };
  }

  async function save() {
    const invalid = validateNewCode(code, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    const err = await enableVault(userId, code, remember);
    if (err) setError(err);
    else reset();
  }

  async function unlock() {
    setError(null);
    const err = await unlockWithCode(userId, code, remember);
    if (err) setError(err);
    else reset();
  }

  const rememberSwitch = (
    <SwitchRow
      label={t('vault.remember')}
      hint={t('vault.rememberHint')}
      value={remember}
      onValueChange={(v) => {
        setPrefs((p) => ({ ...p, rememberVaultKey: v }));
        void setRememberKey(v);
      }}
    />
  );
  const errorLine = error ? <ErrorText>{t(`vault.errors.${error}`)}</ErrorText> : null;

  if (status === 'working') {
    return (
      <VaultBox icon={LockKeyhole} title={t('vault.title')}>
        <Row>
          <ActivityIndicator color={colors.primary} />
          <Text variant="small" tone="muted" style={styles.titleText}>
            {t('vault.working')}
          </Text>
        </Row>
      </VaultBox>
    );
  }

  if (status === 'unlocked') {
    return (
      <VaultBox icon={LockKeyholeOpen} title={t('vault.title')}>
        <Text variant="small">{t('vault.saved')}</Text>
        {rememberSwitch}
      </VaultBox>
    );
  }

  if (status === 'locked') {
    return (
      <VaultBox icon={LockKeyhole} title={t('vault.unlockTitle')}>
        <CodeField label={t('vault.code')} value={code} onChange={editCode(setCode)} />
        {rememberSwitch}
        {errorLine}
        <Button label={t('vault.unlock')} onPress={() => void unlock()} disabled={code.length === 0} />
      </VaultBox>
    );
  }

  if (status === 'none' && hasProgram) {
    return (
      <VaultBox icon={KeyRound} title={t('vault.title')}>
        <Text variant="small" tone="muted">
          {t('vault.saveHint')}
        </Text>
        {open ? (
          <>
            <NextStep>{t('vault.warning')}</NextStep>
            <CodeField label={t('vault.code')} value={code} onChange={editCode(setCode)} />
            <CodeField label={t('vault.codeConfirm')} value={confirm} onChange={editCode(setConfirm)} />
            {rememberSwitch}
            {errorLine}
            <Row style={styles.actions}>
              <Button label={t('vault.submit')} onPress={() => void save()} />
              <Button label={t('vault.cancel')} onPress={reset} variant="ghost" />
            </Row>
          </>
        ) : (
          <Button label={t('vault.save')} onPress={() => setOpen(true)} variant="outline" />
        )}
      </VaultBox>
    );
  }

  return null;
}
