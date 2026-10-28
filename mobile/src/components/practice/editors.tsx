/**
 * Editors shared by «أضف عادة» and the plan screen: reminder slots, active days per week, reminder weekdays.
 */

import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { LocalTime } from '@thekra/practice-core';
import { normalizeTimeInput, sortSlots } from '@/lib/practice/format';
import { Body, Button, Chip, ErrorText, Row, Wrap, practiceStyles } from './ui';

export function SlotsEditor({ slots, onChange }: { slots: LocalTime[]; onChange: (slots: LocalTime[]) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function add() {
    const time = normalizeTimeInput(draft);
    if (!time) {
      setError(t('practice.add.invalidTime'));
      return;
    }
    setError(null);
    setDraft('');
    onChange(sortSlots([...slots, time]));
  }

  return (
    <View style={{ gap: 8 }}>
      <Body small muted>
        {t('practice.add.slotsHint')}
      </Body>
      <Wrap>
        {slots.map((s) => (
          <Chip
            key={s}
            label={`${s}  ✕`}
            selected
            onPress={() => onChange(slots.filter((x) => x !== s))}
          />
        ))}
      </Wrap>
      <Row>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('practice.add.slotPlaceholder')}
          keyboardType="numbers-and-punctuation"
          style={[practiceStyles.input, { flex: 1, writingDirection: 'ltr', textAlign: 'center' }]}
          onSubmitEditing={add}
          accessibilityLabel={t('practice.add.slots')}
          maxLength={5}
        />
        <Button label={t('practice.add.addSlot')} onPress={add} variant="outline" compact />
      </Row>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {slots.length === 0 ? <ErrorText>{t('practice.add.noSlots')}</ErrorText> : null}
      {slots.length === 1 ? (
        <Body small muted>
          {t('practice.add.slotsOneWarning')}
        </Body>
      ) : null}
    </View>
  );
}

export function ActiveDaysPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 8 }}>
      <Body small muted>
        {t('practice.add.activeDaysHint')}
      </Body>
      <Wrap>
        {[2, 3, 4, 5, 6, 7].map((n) => (
          <Chip key={n} label={t('practice.add.daysCount', { n: String(n) })} selected={value === n} onPress={() => onChange(n)} />
        ))}
      </Wrap>
    </View>
  );
}

export function WeekdayPicker({ value, onChange, single }: { value: number[]; onChange: (v: number[]) => void; single?: boolean }) {
  const { t } = useTranslation();
  return (
    <Wrap>
      {[6, 0, 1, 2, 3, 4, 5].map((d) => {
        const selected = value.includes(d);
        return (
          <Chip
            key={d}
            label={t(`practice.weekdays.${d}`)}
            selected={selected}
            onPress={() => {
              if (single) onChange([d]);
              else onChange(selected ? value.filter((x) => x !== d) : [...value, d].sort());
            }}
          />
        );
      })}
    </Wrap>
  );
}

/** HH:MM field; accepts Arabic-Indic digits and «9.30»; reports only valid times. */
export function TimeField({ label, value, onChange }: { label: string; value: LocalTime; onChange: (t: LocalTime) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <Body small>{label}</Body>
      <TextInput
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          const time = normalizeTimeInput(text);
          setInvalid(!time);
          if (time) onChange(time);
        }}
        keyboardType="numbers-and-punctuation"
        style={[practiceStyles.input, { writingDirection: 'ltr', textAlign: 'center' }]}
        maxLength={5}
        accessibilityLabel={label}
      />
      {invalid ? <ErrorText>{t('practice.add.invalidTime')}</ErrorText> : null}
    </View>
  );
}
