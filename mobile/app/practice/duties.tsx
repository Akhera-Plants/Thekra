/**
 * «فروضي وأدواري» (lecture analysis §4 and §8.1): roles first (device prefs), then free minutes per day (Store
 * settings, synced); practice-core `loadWarning` says 'over' when the minute-based habits take more than half of
 * that free time.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Hourglass } from 'lucide-react-native';
import { dailyLoad, loadWarning, updateSettings } from '@thekra/practice-core';
import { toWesternDigits } from '@/lib/practice/format';
import { ROLE_KEYS, type RoleKey } from '@/lib/practice/prefs';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { space, useStyles } from '@/theme';
import { Chip, Field, Loading, NextStep, Notice, PageHeader, Rule, Screen, Section, Text, Wrap } from '@/ui';

const PRESETS = [60, 120, 180, 240, 300];
const MAX_MINUTES = 24 * 60;

const makeStyles = () => ({
  group: { gap: space.md },
  minutes: { writingDirection: 'ltr' as const, textAlign: 'center' as const },
  minutesField: { maxWidth: 160 },
});

export default function DutiesScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const plans = usePracticeStore((s) => s.store.plans);
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const setStore = usePracticeStore((s) => s.setStore);
  const free = usePracticeStore((s) => s.store.settings.freeMinutesPerDay ?? null);
  const [draft, setDraft] = useState('');

  if (!hydrated) return <Loading />;

  const d = today();
  const load = dailyLoad(plans, d);
  const warning = free !== null ? loadWarning(plans, free, d) : null;

  // Synced with the account: practice-core `updateSettings` stamps the version.
  function setFree(value: number) {
    setStore((s) => updateSettings(s, { freeMinutesPerDay: value }));
  }

  function toggleRole(role: RoleKey, selected: boolean) {
    setPrefs((p) => ({ ...p, roles: selected ? p.roles.filter((r) => r !== role) : [...p.roles, role] }));
  }

  function handleDraft(text: string) {
    setDraft(text);
    const n = Number.parseInt(toWesternDigits(text), 10);
    if (Number.isFinite(n) && n >= 0 && n <= MAX_MINUTES) setFree(n);
  }

  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader title={t('practice.duties.title')} lead={t('practice.duties.intro')} />

      <Section title={t('practice.duties.roles')}>
        <Wrap>
          {ROLE_KEYS.map((role) => {
            const selected = prefs.roles.includes(role);
            return (
              <Chip key={role} label={t(`practice.duties.role.${role}`)} selected={selected} onPress={() => toggleRole(role, selected)} />
            );
          })}
        </Wrap>
      </Section>

      <Rule />

      <View style={styles.group}>
        <Text variant="heading" accessibilityRole="header">
          {t('practice.duties.freeMinutes')}
        </Text>
        <Text variant="small" tone="muted">
          {t('practice.duties.freeHint')}
        </Text>
        <Wrap>
          {PRESETS.map((m) => (
            <Chip key={m} label={t('practice.duties.minutes', { count: m })} selected={free === m} onPress={() => setFree(m)} />
          ))}
        </Wrap>
        <View style={styles.minutesField}>
          <Field
            value={draft}
            onChangeText={handleDraft}
            placeholder={free !== null ? String(free) : String(PRESETS[1])}
            keyboardType="number-pad"
            returnKeyType="done"
            autoComplete="off"
            maxLength={4}
            accessibilityLabel={t('practice.duties.freeMinutes')}
            style={styles.minutes}
          />
        </View>
      </View>

      {free === null ? (
        <Notice icon={Hourglass}>{t('practice.duties.notSet')}</Notice>
      ) : (
        <View style={styles.group}>
          <Text variant="body">{t('practice.duties.load', { load: String(load), free: String(free) })}</Text>
          {warning === 'over' ? (
            <NextStep>{t('practice.duties.over')}</NextStep>
          ) : (
            <Notice icon={CircleCheck}>{t('practice.duties.ok')}</Notice>
          )}
        </View>
      )}
    </Screen>
  );
}
