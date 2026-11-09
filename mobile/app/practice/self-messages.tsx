/**
 * «رسائلي إلى نفسي» (owner round 6, C-02c): the member's own short lines, opened from the top of «العادات» (no longer
 * inside «محاسبتي»). A list, newest first, with «أضف» (at most 10, the count on the title line), and each line's
 * «تعديل» opening a sheet where it is edited or deleted (deletion is confirmed in that sheet; owner rule: destructive
 * only inside an edit sheet). A line written in «أضف عادة» names its habit. Device-local like the rest of the heart
 * data (practice-core heart.ts): private words, never sent. Every save toasts.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Mail, Plus, Trash2 } from 'lucide-react-native';
import {
  addSelfMessage,
  editSelfMessage,
  removeSelfMessage,
  SELF_MESSAGE_MAX_LENGTH,
  SELF_MESSAGES_MAX,
  selfMessageError,
  selfMessages,
  type SelfMessage,
} from '@thekra/practice-core';
import { useShortDate } from '@/lib/practice/use-habits-hub';
import { usePracticeCatalog } from '@/lib/api/practice';
import { newPracticeId, usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { planTitleOf } from '@/components/practice/hub/HeartCards';
import { space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, ButtonPair, EmptyState, ErrorText, Field, Loading, PageHeader, Screen, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  row: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  rowLast: { borderBottomWidth: 0 },
  texts: { flex: 1, minWidth: 0, gap: 4 },
  stack: { gap: space.md },
  input: { minHeight: 96, textAlignVertical: 'top' as const, paddingTop: space.sm },
});

type Editing = { kind: 'new' } | { kind: 'edit'; message: SelfMessage } | null;

export default function SelfMessagesScreen() {
  const shortDate = useShortDate();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const heart = usePracticeStore((s) => s.heart);
  const plans = usePracticeStore((s) => s.store.plans);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const [editing, setEditing] = useState<Editing>(null);
  if (!hydrated) return <Loading />;
  const list = selfMessages(heart);
  const full = list.length >= SELF_MESSAGES_MAX;
  const habitOf = (m: SelfMessage) => {
    const plan = m.planId ? plans.find((p) => p.id === m.planId) : undefined;
    return plan ? planTitleOf(plan, habits, locale) : null;
  };
  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader
        title={t('habitsHub.messages.title')}
        lead={t('habitsHub.messages.lead')}
        action={list.length > 0 ? <Button label={t('habitsHub.messages.add')} icon={Plus} size="sm" disabled={full} onPress={() => setEditing({ kind: 'new' })} /> : undefined}
      />
      {list.length > 0 ? (
        <Text variant="small" tone="muted">
          {t('habitsHub.messages.count', { count: list.length, max: SELF_MESSAGES_MAX })}
        </Text>
      ) : null}
      {list.length === 0 ? (
        <EmptyState icon={Mail} message={t('habitsHub.messages.empty')} hint={t('habitsHub.messages.emptyHint')} actionLabel={t('habitsHub.messages.add')} onAction={() => setEditing({ kind: 'new' })} />
      ) : (
        <View>
          {list.map((m, i) => {
            const habit = habitOf(m);
            return (
              <View key={m.id} style={[styles.row, i === list.length - 1 && styles.rowLast]}>
                <View style={styles.texts}>
                  <Text variant="body">{m.text}</Text>
                  <Text variant="caption" tone="muted">
                    {[habit, shortDate(m.updatedAt.slice(0, 10))].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Button label={t('habitsHub.periodic.edit')} variant="ghost" size="sm" onPress={() => setEditing({ kind: 'edit', message: m })} accessibilityLabel={`${t('habitsHub.periodic.edit')}: ${m.text.slice(0, 40)}`} />
              </View>
            );
          })}
        </View>
      )}
      {full ? (
        <Text variant="small" tone="muted">
          {t('habitsHub.messages.full')}
        </Text>
      ) : null}
      <MessageSheet editing={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function MessageSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const [text, setText] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Editing>(null);
  if (editing !== opened) {
    setOpened(editing);
    setText(editing?.kind === 'edit' ? editing.message.text : '');
    setAsking(false);
    setError(null);
  }
  function save() {
    const id = editing?.kind === 'edit' ? editing.message.id : undefined;
    const problem = selfMessageError(heart, text, id);
    if (problem) {
      setError(t(problem === 'full' ? 'habitsHub.messages.full' : 'habitsHub.messages.emptyError'));
      return;
    }
    if (id) setHeart((h) => editSelfMessage(h, id, text));
    else setHeart((h) => addSelfMessage(h, { id: newPracticeId(), text }));
    toast(t(id ? 'habitsHub.messages.savedToast' : 'habitsHub.messages.addedToast'));
    onClose();
  }
  return (
    <BottomSheet visible={editing !== null} title={editing?.kind === 'edit' ? t('habitsHub.messages.editTitle') : t('habitsHub.messages.add')} onClose={onClose}>
      {asking && editing?.kind === 'edit' ? (
        <View style={styles.stack}>
          <Text variant="body">{t('habitsHub.messages.deleteBody')}</Text>
          <ButtonPair
            primary={{
              label: t('common.delete'),
              variant: 'destructive',
              onPress: () => {
                setHeart((h) => removeSelfMessage(h, editing.message.id));
                toast(t('habitsHub.messages.deletedToast'));
                onClose();
              },
            }}
            secondary={{ label: t('common.cancel'), onPress: () => setAsking(false) }}
          />
        </View>
      ) : (
        <View style={styles.stack}>
          <Field
            label={t('habitsHub.add.messageLabel')}
            placeholder={t('habitsHub.add.messagePlaceholder')}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            maxLength={SELF_MESSAGE_MAX_LENGTH}
            multiline
            style={styles.input}
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <ButtonPair primary={{ label: t('habitsHub.messages.save'), onPress: save }} secondary={{ label: t('common.cancel'), onPress: onClose }} />
          {editing?.kind === 'edit' ? <Button label={t('habitsHub.messages.delete')} icon={Trash2} variant="destructive" onPress={() => setAsking(true)} /> : null}
        </View>
      )}
    </BottomSheet>
  );
}
