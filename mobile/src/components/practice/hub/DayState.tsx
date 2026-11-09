/**
 * «حال يومي» (owner round 6, C-01r; replaces the round-5 switches «يومي ثقيل» / «عذر»): one small outlined control
 * that names the day's state when it is not a normal day, and opens a list — يوم عادي · مرض شديد · انشغالات طارئة ·
 * سفر — each with its one-line effect. Choosing applies practice-core `setDayState` (the data meaning of the old
 * switches is kept: sick/travel are excused days, busy is the one-day ebb), closes the sheet and toasts. A hard state
 * makes every habit ask its «القدر الأدنى» (`requiredOnDay`); the «اليوم» tab then shows the gentle line. When a state
 * is on, the control takes the selected look and a check, so «on» does not rest on the label alone. Hidden without a
 * habit.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CircleCheck, CloudSun } from 'lucide-react-native';
import { DAY_STATES, dayStateOn, setDayState, type DayState as DayStateKey, type LocalDate } from '@thekra/practice-core';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, CheckRow, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  on: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.link },
  list: { gap: space.sm },
});

export function DayState({ today, date = today }: { today: LocalDate; date?: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  if (store.plans.length === 0) return null;
  const view = dayStateOn(store, date);
  const on = view.state !== 'normal';
  const stateLabel = (s: DayStateKey) => t(`habitsHub.dayState.states.${s}`);
  const label = on ? stateLabel(view.state) : t('habitsHub.dayState.button');

  function choose(state: DayStateKey) {
    setStore((s) => setDayState(s, date, state, today));
    setOpen(false);
    toast(state === 'normal' ? t('habitsHub.dayState.normalToast') : t('habitsHub.dayState.setToast', { state: stateLabel(state) }));
  }

  return (
    <>
      <Button
        label={label}
        icon={on ? CircleCheck : CloudSun}
        variant="outline"
        style={on ? styles.on : undefined}
        size="sm"
        onPress={() => setOpen(true)}
        accessibilityLabel={`${t('habitsHub.dayState.button')}: ${label}`}
      />
      <BottomSheet visible={open} title={t('habitsHub.dayState.button')} onClose={() => setOpen(false)}>
        <Text variant="small" tone="muted">
          {t('habitsHub.dayState.lead')}
        </Text>
        <View style={styles.list} accessibilityRole="radiogroup">
          {DAY_STATES.map((state) => (
            <CheckRow
              key={state}
              radio
              title={stateLabel(state)}
              hint={t(`habitsHub.dayState.hints.${state}`)}
              checked={view.state === state}
              onPress={() => choose(state)}
            />
          ))}
        </View>
      </BottomSheet>
    </>
  );
}
