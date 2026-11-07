/**
 * «تذكيراتي» (redesign §4.6), the second tab of «المحفوظات» (owner round 5, F-22 a): the user's own short lines, kept on
 * this device only (the only mode for now). At most 20 lines of 120 characters (practice-core). They can be the
 * widget's «نص اليوم». Each line's «احذف» is behind its «⋯», confirmed, then a toast with «تراجع» (round-4 rule: no
 * destructive link under each item).
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react-native';
import { addMyReminder, MY_REMINDER_MAX_LENGTH, MY_REMINDERS_MAX, myReminderError, removeMyReminder, type MyReminder } from '@thekra/practice-core';
import { newPracticeId, usePracticeStore } from '@/lib/practice/practice-store';
import { space, useStyles, type Theme } from '@/theme';
import { ActionMenu, Button, ErrorText, Field, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, minWidth: 0 },
  stack: { gap: space.md },
  addRow: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: space.sm },
  addField: { flex: 1 },
  /** On the field's line, level with the input (the kit button otherwise sits at the row's top). */
  addButton: { alignSelf: 'flex-end' as const },
  /** No top rule: the first row sits under its section title (A-05). */
  list: {},
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
    toast(t('myReminders.addedToast'));
  }

  function remove(item: MyReminder) {
    const before = usePracticeStore.getState().prefs.myReminders;
    setPrefs((p) => ({ ...p, myReminders: removeMyReminder(p.myReminders, item.id) }));
    toast({ message: t('myReminders.removedToast'), actionLabel: t('common.undo'), onAction: () => setPrefs((p) => ({ ...p, myReminders: before })) });
  }

  return (
    <>
      <View style={styles.stack}>
        <Text variant="small" tone="muted">
          {`${t('myReminders.lead')} ${t('myReminders.count', { n: list.length, max: MY_REMINDERS_MAX })}`}
        </Text>
        {/* The field and its «أضف» on one line, the same height (A-07). */}
        <View style={styles.addRow}>
          <Field
            label={t('myReminders.newLabel')}
            value={text}
            maxLength={MY_REMINDER_MAX_LENGTH}
            onChangeText={setText}
            onSubmitEditing={add}
            containerStyle={styles.addField}
          />
          <Button label={t('myReminders.add')} onPress={add} disabled={list.length >= MY_REMINDERS_MAX} style={styles.addButton} />
        </View>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </View>
      {list.length === 0 ? (
        <Text variant="body" tone="muted">
          {t('myReminders.empty')}
        </Text>
      ) : (
        <View style={styles.list}>
          {list.map((item, i) => (
            <View key={item.id} style={[styles.row, i === list.length - 1 && styles.rowLast]}>
              <Text variant="body" style={styles.rowText}>
                {item.text}
              </Text>
              <ActionMenu
                label={t('myReminders.actions', { text: item.text })}
                items={[
                  {
                    label: t('myReminders.remove'),
                    icon: Trash2,
                    destructive: true,
                    onPress: () => remove(item),
                    confirm: { title: t('myReminders.removeTitle'), message: item.text, confirmLabel: t('myReminders.remove') },
                  },
                ]}
              />
            </View>
          ))}
        </View>
      )}
    </>
  );
}
