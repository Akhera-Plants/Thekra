/**
 * «دفتر المحاسبة» (proposals item 5): every day the user wrote, newest first: the morning intention (the habit and the
 * optional line) and the evening answers under the catalog's questions, with «الحمد لله على ما كان» when tapped.
 * Device only (tazkiya-store.ts): not synced, never in a notification, not in the account export. A day can be
 * deleted, and so can the whole notebook (confirmed; it cannot be recovered).
 */

import React, { memo, useCallback, useMemo } from 'react';
import { Alert, FlatList, View, type ListRenderItem } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BookHeart, HandHeart, Trash2 } from 'lucide-react-native';
import { MUHASABA_QUESTIONS, deleteDay, notebook, type JournalDay } from '@thekra/practice-core';
import { pick, type TazkiyaPrompts } from '@/lib/practice/catalog-types';
import { dayTitle } from '@/lib/practice/calendar-grid';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useDateNames } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useJournal, useTazkiyaPrompts } from '@/lib/practice/use-tazkiya';
import { useTazkiyaStore } from '@/lib/practice/tazkiya-store';
import { GUTTER, space, useStyles, type Theme } from '@/theme';
import { Button, EmptyState, Icon, IconButton, Loading, Notice, PageHeader, Screen, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  list: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] },
  header: { gap: space.lg, paddingBottom: space.lg },
  fill: { backgroundColor: t.colors.background },
  day: { paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border, gap: space.sm },
  dayHead: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: space.sm },
  line: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.sm },
  flex: { flex: 1, gap: 2 },
  footer: { paddingTop: space.xl },
});

const keyOf = (day: JournalDay) => day.date;

interface DayEntryProps {
  day: JournalDay;
  title: string;
  prompts: TazkiyaPrompts | undefined;
  onDelete: (date: string) => void;
}

const DayEntry = memo(function DayEntry({ day, title, prompts, onDelete }: DayEntryProps) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const handleDelete = useCallback(() => onDelete(day.date), [onDelete, day.date]);
  const questions = prompts?.muhasaba.questions;
  return (
    <View style={styles.day}>
      <View style={styles.dayHead}>
        <Text variant="heading" accessibilityRole="header" style={styles.flex}>
          {title}
        </Text>
        <IconButton icon={Trash2} label={t('tazkiya.deleteDay')} onPress={handleDelete} />
      </View>
      {day.niyyah ? (
        <View style={styles.line}>
          <Icon icon={HandHeart} size={16} tone="link" strokeWidth={1.6} />
          <View style={styles.flex}>
            <Text variant="small" weight="medium">{`${t('tazkiya.niyyahLabel')}: ${day.niyyah.title}`}</Text>
            {day.niyyah.note ? (
              <Text variant="small" tone="muted">
                {day.niyyah.note}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {day.muhasaba
        ? MUHASABA_QUESTIONS.map((key) => {
            const answer = day.muhasaba?.answers[key];
            if (!answer) return null;
            const question = questions?.find((q) => q.key === key);
            return (
              <View key={key} style={styles.flex}>
                {question ? (
                  <Text variant="caption" tone="muted">
                    {pick(question, 'text', locale)}
                  </Text>
                ) : null}
                <Text variant="body">{answer}</Text>
              </View>
            );
          })
        : null}
      {day.muhasaba?.thanked && prompts ? (
        <Text variant="small" weight="medium" tone="link">
          {pick(prompts.muhasaba, 'thanks', locale)}
        </Text>
      ) : null}
    </View>
  );
});

export default function NotebookScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const prompts = useTazkiyaPrompts();
  const { hydrated, journal } = useJournal();
  const update = useTazkiyaStore((s) => s.update);
  const clear = useTazkiyaStore((s) => s.clear);
  const days = useMemo(() => notebook(journal), [journal]);

  const handleDelete = useCallback(
    (date: string) => {
      Alert.alert(t('tazkiya.deleteDay'), t('tazkiya.deleteDayConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => update((j) => deleteDay(j, date)) },
      ]);
    },
    [t, update],
  );
  const handleDeleteAll = useCallback(() => {
    Alert.alert(t('tazkiya.deleteAll'), t('tazkiya.deleteAllConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void clear() },
    ]);
  }, [t, clear]);

  const renderDay: ListRenderItem<JournalDay> = useCallback(
    ({ item }) => <DayEntry day={item} title={dayTitle(item.date, hijriOffset, names)} prompts={prompts} onDelete={handleDelete} />,
    [hijriOffset, names, prompts, handleDelete],
  );

  if (!hydrated) return <Loading />;

  return (
    <Screen scroll={false} edges={['bottom']} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <FlatList
        data={days}
        keyExtractor={keyOf}
        renderItem={renderDay}
        style={styles.fill}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <PageHeader title={t('tazkiya.notebookTitle')} />
            <Notice>{t('tazkiya.notebookPrivate')}</Notice>
          </View>
        }
        ListEmptyComponent={<EmptyState icon={BookHeart} message={t('tazkiya.notebookEmpty')} />}
        ListFooterComponent={
          days.length > 0 ? (
            <View style={styles.footer}>
              <Button label={t('tazkiya.deleteAll')} icon={Trash2} onPress={handleDeleteAll} variant="ghost" />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
