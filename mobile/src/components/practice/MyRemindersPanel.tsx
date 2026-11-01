/**
 * «تذكيراتي» (redesign §4.6), the second part of «المحفوظات» (owner, 2026-11-01): the user's own short lines, kept on
 * this device only (the only mode for now). At most 20 lines of 120 characters (practice-core). They can be the
 * widget's «نص اليوم».
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addMyReminder, MY_REMINDER_MAX_LENGTH, MY_REMINDERS_MAX, myReminderError, removeMyReminder } from '@thekra/practice-core';
import { newPracticeId, usePracticeStore } from '@/lib/practice/practice-store';
import { space, useStyles, type Theme } from '@/theme';
import { Button, ErrorText, Field, Text, TextLink } from '@/ui';

const makeStyles = (t: Theme) => ({
  row: { paddingVertical: space.sm, gap: space.xs, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  stack: { gap: space.md },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
});

export function MyRemindersPanel() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const list = usePracticeStore((s) => s.prefs.myReminders);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function add() {
    const problem = myReminderError(list, text);
    if (problem) {
      setError(t(`myReminders.errors.${problem}`, { max: MY_REMINDER_MAX_LENGTH, n: MY_REMINDERS_MAX }));
      return;
    }
    setPrefs((p) => ({ ...p, myReminders: addMyReminder(p.myReminders, text, newPracticeId(), new Date().toISOString()) }));
    setText('');
    setError(null);
  }

  return (
    <>
      <View style={styles.stack}>
        <Text variant="small" tone="muted">
          {`${t('myReminders.lead')} ${t('myReminders.count', { n: list.length, max: MY_REMINDERS_MAX })}`}
        </Text>
        <Field label={t('myReminders.newLabel')} value={text} maxLength={MY_REMINDER_MAX_LENGTH} onChangeText={setText} onSubmitEditing={add} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button label={t('myReminders.add')} onPress={add} disabled={list.length >= MY_REMINDERS_MAX} />
      </View>
      {list.length === 0 ? (
        <Text variant="body" tone="muted">
          {t('myReminders.empty')}
        </Text>
      ) : (
        <View style={styles.list}>
          {list.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text variant="body">{item.text}</Text>
              <TextLink
                label={t('myReminders.remove')}
                onPress={() => setPrefs((p) => ({ ...p, myReminders: removeMyReminder(p.myReminders, item.id) }))}
              />
            </View>
          ))}
        </View>
      )}
    </>
  );
}
