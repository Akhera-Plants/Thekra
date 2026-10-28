/**
 * «فروضي وأدواري» (lecture analysis §4 and §8.1): roles first, then free minutes per day; practice-core
 * `loadWarning` says 'over' when the minute-based habits take more than half of that free time.
 */

import React, { useState } from 'react';
import { TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { dailyLoad, loadWarning } from '@thekra/practice-core';
import { toWesternDigits } from '@/lib/practice/format';
import { ROLE_KEYS } from '@/lib/practice/prefs';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { Body, Card, Chip, Loading, Screen, SectionTitle, Subtitle, Wrap, practiceStyles } from '@/components/practice/ui';

const PRESETS = [60, 120, 180, 240, 300];

export default function DutiesScreen() {
  const { t } = useTranslation();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const plans = usePracticeStore((s) => s.store.plans);
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [draft, setDraft] = useState('');

  if (!hydrated) return <Loading />;

  const d = today();
  const free = prefs.freeMinutesPerDay;
  const load = dailyLoad(plans, d);
  const warning = free !== null ? loadWarning(plans, free, d) : null;

  function setFree(value: number | null) {
    setPrefs((p) => ({ ...p, freeMinutesPerDay: value }));
  }

  return (
    <Screen>
      <Subtitle>{t('practice.duties.intro')}</Subtitle>

      <SectionTitle>{t('practice.duties.roles')}</SectionTitle>
      <Wrap>
        {ROLE_KEYS.map((role) => {
          const selected = prefs.roles.includes(role);
          return (
            <Chip
              key={role}
              label={t(`practice.duties.role.${role}`)}
              selected={selected}
              onPress={() =>
                setPrefs((p) => ({
                  ...p,
                  roles: selected ? p.roles.filter((r) => r !== role) : [...p.roles, role],
                }))
              }
            />
          );
        })}
      </Wrap>

      <SectionTitle>{t('practice.duties.freeMinutes')}</SectionTitle>
      <Body muted small>
        {t('practice.duties.freeHint')}
      </Body>
      <Wrap>
        {PRESETS.map((m) => (
          <Chip key={m} label={t('practice.duties.minutes', { n: String(m) })} selected={free === m} onPress={() => setFree(m)} />
        ))}
      </Wrap>
      <TextInput
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          const n = Number.parseInt(toWesternDigits(text), 10);
          if (Number.isFinite(n) && n >= 0 && n <= 24 * 60) setFree(n);
        }}
        placeholder={free !== null ? String(free) : '120'}
        keyboardType="number-pad"
        style={[practiceStyles.input, { writingDirection: 'ltr', textAlign: 'center' }]}
        accessibilityLabel={t('practice.duties.freeMinutes')}
        maxLength={4}
      />

      <Card tone={warning === 'over' ? 'warning' : 'info'}>
        {free === null ? (
          <Body>{t('practice.duties.notSet')}</Body>
        ) : (
          <>
            <Body>{t('practice.duties.load', { load: String(load), free: String(free) })}</Body>
            <Body>{warning === 'over' ? t('practice.duties.over') : t('practice.duties.ok')}</Body>
          </>
        )}
      </Card>
    </Screen>
  );
}
