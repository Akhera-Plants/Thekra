/**
 * «فروضي وأدواري» (lecture analysis §4 and §8.1): roles first (device prefs), then free minutes per day (Store
 * settings, synced); practice-core `loadWarning` says 'over' when the minute-based habits take more than half of
 * that free time. One control for the minutes: the preset chips, and the number field only behind «وقت آخر». Every choice
 * saves at once; the status line follows it and a brief «حُفظ» confirms it.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, CircleCheck, Hourglass } from 'lucide-react-native';
import { dailyLoad, loadWarning, updateSettings } from '@thekra/practice-core';
import { toWesternDigits } from '@/lib/practice/format';
import { ROLE_KEYS, type RoleKey } from '@/lib/practice/prefs';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { space, useStyles } from '@/theme';
import { Chip, Field, Icon, Loading, NextStep, Notice, PageHeader, Screen, Section, Text, Wrap, SectionDivider } from '@/ui';

const PRESETS = [60, 120, 180, 240, 300];
const MAX_MINUTES = 24 * 60;
const SAVED_MS = 1800;

type Area = 'roles' | 'minutes';

const makeStyles = () => ({
  group: { gap: space.md },
  minutes: { writingDirection: 'ltr' as const, textAlign: 'center' as const },
  minutesField: { maxWidth: 160 },
  saved: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
});

/** The brief «حُفظ» under the group that just changed. */
function Saved({ label }: { label: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.saved} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Icon icon={Check} size={16} tone="link" strokeWidth={2.2} />
      <Text variant="small" weight="medium" tone="link">
        {label}
      </Text>
    </View>
  );
}

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
  const [custom, setCustom] = useState(false);
  const [saved, setSaved] = useState<Area | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!hydrated) return <Loading />;

  function confirmSaved(area: Area) {
    if (timer.current) clearTimeout(timer.current);
    setSaved(area);
    timer.current = setTimeout(() => setSaved(null), SAVED_MS);
  }
  const otherOn = custom || (free !== null && !PRESETS.includes(free));

  const d = today();
  const load = dailyLoad(plans, d);
  const warning = free !== null ? loadWarning(plans, free, d) : null;

  // Synced with the account: practice-core `updateSettings` stamps the version.
  function setFree(value: number) {
    setStore((s) => updateSettings(s, { freeMinutesPerDay: value }));
    confirmSaved('minutes');
  }

  function pickPreset(value: number) {
    setCustom(false);
    setDraft('');
    setFree(value);
  }

  function toggleRole(role: RoleKey, selected: boolean) {
    setPrefs((p) => ({ ...p, roles: selected ? p.roles.filter((r) => r !== role) : [...p.roles, role] }));
    confirmSaved('roles');
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
        {saved === 'roles' ? <Saved label={t('practice.duties.saved')} /> : null}
      </Section>

      <SectionDivider />

      <View style={styles.group}>
        <Text variant="heading" accessibilityRole="header">
          {t('practice.duties.freeMinutes')}
        </Text>
        <Text variant="small" tone="muted">
          {t('practice.duties.freeHint')}
        </Text>
        <Wrap>
          {PRESETS.map((m) => (
            <Chip key={m} label={t('practice.duties.minutes', { count: m })} selected={!otherOn && free === m} onPress={() => pickPreset(m)} />
          ))}
          <Chip label={t('practice.duties.other')} selected={otherOn} onPress={() => setCustom(true)} />
        </Wrap>
        {otherOn ? (
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
              autoFocus={custom}
            />
          </View>
        ) : null}
        {saved === 'minutes' ? <Saved label={t('practice.duties.saved')} /> : null}
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
