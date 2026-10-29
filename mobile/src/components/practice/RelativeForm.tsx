/**
 * The relative form of «صلة الرحم»: nickname, optional relation, rhythm. «أضف قريبًا» opens it empty; a row's edit
 * opens it on that relative, with «حذف» at the end (the screen asks before deleting). No contact autofill: this
 * list never holds contact details (kinship-form.ts).
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react-native';
import { MAX_NAME_LENGTH, type Relative } from '@thekra/practice-core';
import { relativeToFormValues, type RelativeFormError, type RelativeFormValues, type RhythmChoice } from '@/lib/practice/kinship-form';
import { WeekdayPicker } from '@/components/practice/editors';
import { space, useStyles } from '@/theme';
import { Button, Card, Chip, ErrorText, Field, Row, Text, Wrap } from '@/ui';

const RHYTHMS: readonly RhythmChoice[] = ['weekly', 'biweekly', 'monthly', 'everyNDays'];
const EVERY_DAYS = [3, 7, 10, 14, 21] as const;
const RELATION_MAX = 40;
const DEFAULT_WEEKDAY = 5;

const EMPTY: RelativeFormValues = { name: '', relation: '', rhythm: 'weekly', weekday: DEFAULT_WEEKDAY, everyDays: 10 };

const makeStyles = () => ({
  actions: { flexWrap: 'wrap' as const, gap: space.sm },
  formGroup: { gap: space.sm },
});

interface RelativeFormProps {
  title: string;
  /** Edit: the relative the form opens on. */
  relative?: Relative;
  /** Saves the values; returns the form error to show, or null when saved. */
  onSave: (values: RelativeFormValues) => RelativeFormError | null;
  onCancel: () => void;
  /** Edit only: delete this relative (the screen confirms first). */
  onDelete?: () => void;
}

export function RelativeForm({ title, relative, onSave, onCancel, onDelete }: RelativeFormProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [initial] = useState(() => (relative ? relativeToFormValues(relative, DEFAULT_WEEKDAY) : EMPTY));
  const [name, setName] = useState(initial.name);
  const [relation, setRelation] = useState(initial.relation);
  const [rhythm, setRhythm] = useState<RhythmChoice>(initial.rhythm);
  const [weekday, setWeekday] = useState(initial.weekday);
  const [everyDays, setEveryDays] = useState(initial.everyDays);
  const [error, setError] = useState<RelativeFormError | null>(null);

  function handleSave() {
    setError(onSave({ name, relation, rhythm, weekday, everyDays }));
  }

  return (
    <Card>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      <Field
        label={t('kinship.name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder={t('kinship.namePlaceholder')}
        hint={t('kinship.privacy')}
        maxLength={MAX_NAME_LENGTH}
        autoCorrect={false}
        textContentType="none"
        autoComplete="off"
        importantForAutofill="no"
        returnKeyType="next"
      />
      <Field
        label={t('kinship.relation')}
        value={relation}
        onChangeText={(v) => {
          setRelation(v);
          setError(null);
        }}
        placeholder={t('kinship.relationPlaceholder')}
        maxLength={RELATION_MAX}
        textContentType="none"
        autoComplete="off"
        importantForAutofill="no"
        returnKeyType="done"
      />
      <View style={styles.formGroup}>
        <Text variant="label">{t('kinship.rhythm')}</Text>
        <Wrap>
          {RHYTHMS.map((r) => (
            <Chip
              key={r}
              label={t(`kinship.rhythm${r.charAt(0).toUpperCase()}${r.slice(1)}`)}
              selected={rhythm === r}
              onPress={() => setRhythm(r)}
            />
          ))}
        </Wrap>
        <Text variant="caption" tone="muted">
          {t('practice.basis.organizational')}
        </Text>
      </View>
      {rhythm === 'weekly' || rhythm === 'biweekly' ? (
        <View style={styles.formGroup}>
          <Text variant="label">{t('kinship.weekday')}</Text>
          <WeekdayPicker value={[weekday]} onChange={(v) => setWeekday(v[0] ?? DEFAULT_WEEKDAY)} single />
        </View>
      ) : null}
      {rhythm === 'everyNDays' ? (
        <Wrap>
          {EVERY_DAYS.map((n) => (
            <Chip key={n} label={t('kinship.everyDays', { count: n })} selected={everyDays === n} onPress={() => setEveryDays(n)} />
          ))}
        </Wrap>
      ) : null}
      {error ? <ErrorText>{t(`kinship.errors.${error}`)}</ErrorText> : null}
      <Row style={styles.actions}>
        <Button label={t('kinship.save')} onPress={handleSave} />
        <Button label={t('kinship.cancel')} onPress={onCancel} variant="ghost" />
        {onDelete ? <Button label={t('kinship.delete')} icon={Trash2} onPress={onDelete} variant="destructive" /> : null}
      </Row>
    </Card>
  );
}
