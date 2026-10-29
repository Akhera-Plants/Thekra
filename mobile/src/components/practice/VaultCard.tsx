/**
 * «احفظ البرنامج مشفّرًا في حسابك» (sync contract §1, §4): set a «رمز الخصوصية» (≥ 6 characters, typed twice,
 * with the warning that it cannot be recovered and nobody can read the program without it), unlock on another
 * device, and the optional «تذكّر على هذا الجهاز» (off by default; the key goes to expo-secure-store).
 * Shown only when signed in. The code never leaves this component except into practice-core's key derivation.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { privacyCodeProblem } from '@thekra/practice-core';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { enableVault, refreshVault, setRememberKey, unlockWithCode, useVaultState } from '@/lib/practice/vault-runner';
import { Colors } from '@/lib/tokens';
import { Body, Button, Card, ErrorText, Row, SwitchRow, practiceStyles } from './ui';

/** i18n key under `vault.errors` for a new code, or null when it can be used (practice-core `privacyCodeProblem`). */
export function validateNewCode(code: string, confirm: string): 'tooShort' | 'weak' | 'mismatch' | null {
  const problem = privacyCodeProblem(code);
  if (problem === 'short') return 'tooShort';
  if (problem === 'weak') return 'weak';
  if (code !== confirm) return 'mismatch';
  return null;
}

export function VaultCard({ userId, hasProgram }: { userId: string; hasProgram: boolean }) {
  const { t } = useTranslation();
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

  const codeInput = (value: string, onChange: (v: string) => void, label: string) => (
    <TextInput
      value={value}
      onChangeText={(v) => {
        onChange(v);
        setError(null);
      }}
      placeholder={label}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      textContentType="none"
      style={practiceStyles.input}
      accessibilityLabel={label}
    />
  );

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

  if (status === 'working') {
    return (
      <Card tone="private">
        <Row>
          <ActivityIndicator color={Colors.primary} />
          <Body small>{t('vault.working')}</Body>
        </Row>
      </Card>
    );
  }

  if (status === 'unlocked') {
    return (
      <Card tone="private">
        <Body small>{t('vault.saved')}</Body>
        {rememberSwitch}
      </Card>
    );
  }

  if (status === 'locked') {
    return (
      <Card tone="private">
        <Body>{t('vault.unlockTitle')}</Body>
        {codeInput(code, setCode, t('vault.code'))}
        {rememberSwitch}
        {error ? <ErrorText>{t(`vault.errors.${error}`)}</ErrorText> : null}
        <Button label={t('vault.unlock')} onPress={() => void unlock()} disabled={code.length === 0} compact />
      </Card>
    );
  }

  if (status === 'none' && hasProgram) {
    return (
      <Card tone="private">
        <Body>{t('vault.save')}</Body>
        <Body small muted>
          {t('vault.saveHint')}
        </Body>
        {open ? (
          <>
            {codeInput(code, setCode, t('vault.code'))}
            {codeInput(confirm, setConfirm, t('vault.codeConfirm'))}
            <Body small>{t('vault.warning')}</Body>
            {rememberSwitch}
            {error ? <ErrorText>{t(`vault.errors.${error}`)}</ErrorText> : null}
            <Row>
              <Button label={t('vault.submit')} onPress={() => void save()} compact />
              <Button label={t('vault.cancel')} onPress={reset} variant="ghost" compact />
            </Row>
          </>
        ) : (
          <Button label={t('vault.save')} onPress={() => setOpen(true)} variant="outline" compact />
        )}
      </Card>
    );
  }

  return null;
}
