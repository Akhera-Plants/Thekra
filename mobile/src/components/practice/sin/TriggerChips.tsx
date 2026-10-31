/**
 * «ما الذي سبقها؟»: three optional rows of chips (when / where / feeling), one choice per row, a second tap clears it.
 * Chips only, no free text: they stay inside the program on this device (and the encrypted vault).
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TRIGGER_FEELINGS, TRIGGER_PLACES, TRIGGER_TIMES, type Triggers } from '@thekra/practice-core';
import { space, useStyles } from '@/theme';
import { Chip, Text } from '@/ui';

const makeStyles = () => ({
  block: { gap: space.md },
  row: { gap: space.xs },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
});

interface ChipRowProps<K extends string> {
  label: string;
  options: readonly K[];
  labelOf: (key: K) => string;
  selected: K | undefined;
  onSelect: (key: K | undefined) => void;
}

function ChipRow<K extends string>({ label, options, labelOf, selected, onSelect }: ChipRowProps<K>) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <View style={styles.chips}>
        {options.map((key) => (
          <Chip key={key} label={labelOf(key)} selected={selected === key} onPress={() => onSelect(selected === key ? undefined : key)} />
        ))}
      </View>
    </View>
  );
}

export function TriggerChips({ value, onChange, showTitle = true }: { value: Triggers; onChange: (next: Triggers) => void; showTitle?: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.block}>
      {showTitle ? <Text variant="label">{t('sinProgram.triggers.title')}</Text> : null}
      <ChipRow
        label={t('sinProgram.triggers.when')}
        options={TRIGGER_TIMES}
        labelOf={(k) => t(`sinProgram.triggers.times.${k}`)}
        selected={value.when}
        onSelect={(when) => onChange({ ...value, when })}
      />
      <ChipRow
        label={t('sinProgram.triggers.where')}
        options={TRIGGER_PLACES}
        labelOf={(k) => t(`sinProgram.triggers.places.${k}`)}
        selected={value.where}
        onSelect={(where) => onChange({ ...value, where })}
      />
      <ChipRow
        label={t('sinProgram.triggers.feeling')}
        options={TRIGGER_FEELINGS}
        labelOf={(k) => t(`sinProgram.triggers.feelings.${k}`)}
        selected={value.feeling}
        onSelect={(feeling) => onChange({ ...value, feeling })}
      />
    </View>
  );
}
