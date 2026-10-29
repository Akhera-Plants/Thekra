/**
 * صلة الرحم, on the device (roadmap §2.4, silat-rahim-plan): a nickname and a rhythm per relative, never
 * contact details (practice-core `looksLikeContactDetails` through kinship-form.ts). «تواصلت معه» restarts the
 * cycle, «تراجع» removes the last log. Due list: overdue / this week / later. Optional reminders: generic
 * text unless the user turns names on. `?add=1` opens the add form directly (the hub's «أضف»).
 *
 * Layout after the website's kinship page: the page title, the add form (a bordered card), the due buckets as
 * hairline-divided lists, then the reminders. Deleting a relative asks first (system alert).
 */

import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Plus, Undo2, Users } from 'lucide-react-native';
import { MAX_NAME_LENGTH, deleteRelative, dueList, logContact, undoContact, updateRelative, upsertRelative, type DueEntry, type Relative } from '@thekra/practice-core';
import { shortDate } from '@/lib/practice/format';
import { relativeFromForm, type RelativeFormError, type RhythmChoice } from '@/lib/practice/kinship-form';
import { ensurePermission } from '@/lib/practice/notifications';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { TimeField, WeekdayPicker } from '@/components/practice/editors';
import { space, useStyles, type Theme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  Notice,
  PageHeader,
  Row,
  Rule,
  Screen,
  Section,
  SwitchRow,
  Text,
  Wrap,
} from '@/ui';

const RHYTHMS: readonly RhythmChoice[] = ['weekly', 'biweekly', 'monthly', 'everyNDays'];
const EVERY_DAYS = [3, 7, 10, 14, 21] as const;
const DEFAULT_WEEKDAY = 5;
const RELATION_MAX = 40;

const makeStyles = (t: Theme) => ({
  flex: { flex: 1 },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  row: { paddingVertical: space.lg, gap: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  rowText: { gap: 2 },
  actions: { flexWrap: 'wrap' as const, gap: space.sm },
  formGroup: { gap: space.sm },
});

export default function KinshipScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const relatives = usePracticeStore((s) => s.store.relatives);
  const setStore = usePracticeStore((s) => s.setStore);
  /** `?add=1` (the hub's «أضف» → «قريب») opens the form at once. */
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [adding, setAdding] = useState(add === '1');

  if (!hydrated) return <Loading />;
  const d = today();
  const due = dueList(relatives, d);

  function remove(id: string) {
    Alert.alert(t('kinship.delete'), t('kinship.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => setStore((s) => deleteRelative(s, id)),
      },
    ]);
  }

  const bucket = (title: string, entries: DueEntry[]) =>
    entries.length > 0 ? (
      <Section title={title}>
        <View style={styles.list}>
          {entries.map((e) => (
            <RelativeRow
              key={e.relative.id}
              entry={e}
              onContacted={() => setStore((s) => updateRelative(s, e.relative.id, (r) => logContact(r, d)))}
              onUndo={() => setStore((s) => undoContact(s, e.relative.id))}
              onDelete={() => remove(e.relative.id)}
            />
          ))}
        </View>
      </Section>
    ) : null;

  const form = adding ? (
    <AddRelativeForm
      onCancel={() => setAdding(false)}
      onSave={(rel) => {
        setStore((s) => upsertRelative(s, rel));
        setAdding(false);
      }}
    />
  ) : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <Screen edges={['bottom']}>
        <PageHeader eyebrow={t('practice.title')} title={t('kinship.title')} lead={t('kinship.lead')} />

        {relatives.length === 0 && !adding ? (
          <EmptyState icon={Users} message={t('kinship.empty')} actionLabel={t('kinship.add')} onAction={() => setAdding(true)} />
        ) : (
          form ?? <Button label={t('kinship.add')} icon={Plus} onPress={() => setAdding(true)} variant="outline" />
        )}

        {bucket(t('kinship.overdue'), due.overdue)}
        {bucket(t('kinship.thisWeek'), due.thisWeek)}
        {bucket(t('kinship.later'), due.later)}

        <KinshipReminders />
      </Screen>
    </KeyboardAvoidingView>
  );
}

interface RelativeRowProps {
  entry: DueEntry;
  onContacted: () => void;
  onUndo: () => void;
  onDelete: () => void;
}

/** The website's relative row: name · relation, the due line, then «تواصلت معه», «تراجع», «حذف». */
function RelativeRow({ entry, onContacted, onUndo, onDelete }: RelativeRowProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { relative, nextDue, daysUntilDue } = entry;
  const dueText =
    daysUntilDue < 0
      ? t('kinship.overdueBy', { n: String(-daysUntilDue) })
      : daysUntilDue === 0
        ? t('kinship.dueToday')
        : t('kinship.dueOn', { date: shortDate(nextDue) });
  const lastText = relative.lastContactedOn ? t('kinship.lastContact', { date: shortDate(relative.lastContactedOn) }) : t('kinship.never');
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text variant="body" weight="medium">
          {relative.name}
          {relative.relation ? (
            <Text variant="small" tone="muted">
              {` · ${relative.relation}`}
            </Text>
          ) : null}
        </Text>
        <Text variant="small" tone="muted">
          {`${dueText} · ${lastText}`}
        </Text>
      </View>
      <Row style={styles.actions}>
        <Button label={t('kinship.contacted')} icon={Check} onPress={onContacted} />
        {relative.history.length > 0 ? <Button label={t('kinship.undo')} icon={Undo2} onPress={onUndo} variant="ghost" /> : null}
        <Button label={t('kinship.delete')} onPress={onDelete} variant="ghost" />
      </Row>
    </View>
  );
}

/** Reminders: generic notification text unless names are turned on; notifications asked for only when switched on. */
function KinshipReminders() {
  const { t } = useTranslation();
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [denied, setDenied] = useState(false);

  async function toggleReminders(on: boolean) {
    setDenied(false);
    if (on && !(await ensurePermission(t('practice.notify.channelName')))) {
      setDenied(true);
      return;
    }
    setPrefs((p) => ({ ...p, kinshipReminders: on }));
  }

  return (
    <Section title={t('practice.reminders')}>
      <SwitchRow label={t('kinship.reminders')} value={prefs.kinshipReminders} onValueChange={(v) => void toggleReminders(v)} />
      {denied ? <Notice tone="destructive">{t('practice.permissionDenied')}</Notice> : null}
      {prefs.kinshipReminders ? (
        <>
          <Rule />
          <SwitchRow
            label={t('kinship.showNames')}
            hint={t('kinship.showNamesHint')}
            value={prefs.kinshipShowNames}
            onValueChange={(v) => setPrefs((p) => ({ ...p, kinshipShowNames: v }))}
          />
          <TimeField label={t('kinship.time')} value={prefs.kinshipTime} onChange={(time) => setPrefs((p) => ({ ...p, kinshipTime: time }))} />
        </>
      ) : null}
    </Section>
  );
}

interface AddRelativeFormProps {
  onSave: (rel: Relative) => void;
  onCancel: () => void;
}

/** «أضف قريبًا»: nickname, optional relation, rhythm. No contact autofill: this list never holds contact details. */
function AddRelativeForm({ onSave, onCancel }: AddRelativeFormProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [rhythm, setRhythm] = useState<RhythmChoice>('weekly');
  const [weekday, setWeekday] = useState(DEFAULT_WEEKDAY);
  const [everyDays, setEveryDays] = useState(10);
  const [error, setError] = useState<RelativeFormError | null>(null);

  function save() {
    const res = relativeFromForm({ name, relation, rhythm, weekday, everyDays }, newPracticeId(), today());
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSave(res.relative);
  }

  return (
    <Card>
      <Text variant="heading" accessibilityRole="header">
        {t('kinship.add')}
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
            <Chip key={n} label={t('kinship.everyDays', { n: String(n) })} selected={everyDays === n} onPress={() => setEveryDays(n)} />
          ))}
        </Wrap>
      ) : null}
      {error ? <ErrorText>{t(`kinship.errors.${error}`)}</ErrorText> : null}
      <Row style={styles.actions}>
        <Button label={t('kinship.save')} onPress={save} />
        <Button label={t('kinship.cancel')} onPress={onCancel} variant="ghost" />
      </Row>
    </Card>
  );
}
