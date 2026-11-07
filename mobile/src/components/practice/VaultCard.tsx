/**
 * «تخفَّف» is always kept encrypted in the account (owner decision 2026-11-01; docs/plan/2026-11-01-sin-vault-always-on.md):
 * - `PrivacyCodeForm`: the first program asks for a «رمز الخصوصية» once (typed twice, practice-core
 *   `privacyCodeProblem`, with the plain warning that a forgotten code cannot be recovered and nobody can read the data
 *   without it). It also protects programs a device kept from an older build.
 * - `VaultCodeUnlock`: the code on a new device or without biometrics, and «نسيت الرمز؟» → «ابدأ من جديد» (confirmed).
 * - `VaultStatusCard` (Settings ← «الخصوصية والتشفير»): saved / waiting to save, one line.
 * The code never leaves these components except into practice-core's key derivation, and its inputs refuse autofill
 * and password managers (no textContentType, no autoComplete).
 */

import React, { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CloudUpload, KeyRound, LockKeyhole, LockKeyholeOpen, type LucideIcon } from 'lucide-react-native';
import { privacyCodeProblem } from '@thekra/practice-core';
import { canKeepKeyBehindBiometrics, unlockWithCode, useVaultState, wipeSinProgramEverywhere } from '@/lib/practice/vault-runner';
import { space, useStyles, useTheme } from '@/theme';
import { ButtonPair, Card, ErrorText, Field, Icon, NextStep, Row, Text, TextLink } from '@/ui';

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
  actions: { gap: space.sm },
});

/** The site's vault box: card fill, hairline, the lock icon in primary before the title. */
function VaultBox({ icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
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

/** A privacy-code input: hidden, no autofill, no suggestions, no password-manager save prompt. */
function CodeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
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

function Working() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Row>
      <ActivityIndicator color={colors.primary} />
      <Text variant="small" tone="muted" style={styles.titleText}>
        {t('vault.working')}
      </Text>
    </Row>
  );
}

/** Guest: «تخفَّف» is kept in the account, so it needs signing in. */
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

export interface PrivacyCodeFormProps {
  /** Creates the vault with the code; resolves an error key under `vault.errors`, or null when done. */
  onSubmit: (code: string) => Promise<string | null>;
  onCancel?: () => void;
  /** «ابدأ» for the first program, «احفظ» for programs kept from an older build. */
  submitLabel: string;
}

/** «رمز الخصوصية»: asked once, before the first program; then the fingerprint / face opens «تخفَّف». */
export function PrivacyCodeForm({ onSubmit, onCancel, submitLabel }: PrivacyCodeFormProps) {
  const { t } = useTranslation();
  const status = useVaultState((s) => s.status);
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const edit = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setError(null);
  };

  async function submit() {
    const invalid = validateNewCode(code, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    const err = await onSubmit(code);
    if (err) setError(err);
  }

  return (
    <VaultBox icon={KeyRound} title={t('vault.codeTitle')}>
      <Text variant="small" tone="muted">
        {t(canKeepKeyBehindBiometrics() ? 'vault.codeLead' : 'vault.codeLeadNoBiometrics')}
      </Text>
      <NextStep>{t('vault.warning')}</NextStep>
      <CodeField label={t('vault.code')} value={code} onChange={edit(setCode)} />
      <CodeField label={t('vault.codeConfirm')} value={confirm} onChange={edit(setConfirm)} />
      {error ? <ErrorText>{t(`vault.errors.${error}`)}</ErrorText> : null}
      {status === 'working' ? (
        <Working />
      ) : (
        <ButtonPair
          size="lg"
          primary={{ label: submitLabel, onPress: () => void submit(), disabled: code.length === 0 }}
          secondary={onCancel ? { label: t('common.cancel'), onPress: onCancel } : null}
        />
      )}
    </VaultBox>
  );
}

/** The code on a new device (or without biometrics); a forgotten code → «ابدأ من جديد» (confirmed: the data is lost). */
export function VaultCodeUnlock({ userId, onOpened }: { userId: string; onOpened: () => void }) {
  const { t } = useTranslation();
  const status = useVaultState((s) => s.status);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function unlock() {
    setError(null);
    const err = await unlockWithCode(userId, code);
    if (err) setError(err);
    else onOpened();
  }

  function startOver() {
    Alert.alert(t('vault.startOverTitle'), t('vault.startOverBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vault.startOver'),
        style: 'destructive',
        onPress: () => void wipeSinProgramEverywhere(userId).then(onOpened),
      },
    ]);
  }

  return (
    <VaultBox icon={LockKeyhole} title={t('vault.unlockTitle')}>
      <Text variant="small" tone="muted">
        {t('vault.unlockLead')}
      </Text>
      <CodeField
        label={t('vault.code')}
        value={code}
        onChange={(v) => {
          setCode(v);
          setError(null);
        }}
      />
      {error ? <ErrorText>{t(`vault.errors.${error}`)}</ErrorText> : null}
      {status === 'working' ? (
        <Working />
      ) : (
        <ButtonPair
          size="lg"
          primary={{ label: t('vault.unlock'), onPress: () => void unlock(), disabled: code.length === 0 }}
          secondary={{ label: t('vault.forgot'), onPress: startOver }}
        />
      )}
    </VaultBox>
  );
}

/** Settings: one line on where «تخفَّف» is kept, and whether a change is still waiting to be saved. */
export function VaultStatusCard() {
  const { t } = useTranslation();
  const status = useVaultState((s) => s.status);
  const pending = useVaultState((s) => s.pending);
  const icon = status === 'unlocked' ? LockKeyholeOpen : pending ? CloudUpload : LockKeyhole;
  const line =
    status === 'none'
      ? t('vault.statusNone')
      : pending
        ? t('vault.statusPending')
        : status === 'unlocked'
          ? t('vault.statusSaved')
          : t('vault.statusLocked');
  return (
    <VaultBox icon={icon} title={t('vault.title')}>
      <Text variant="small" tone="muted">
        {line}
      </Text>
    </VaultBox>
  );
}
