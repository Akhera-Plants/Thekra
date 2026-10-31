/**
 * صلة الرحم, on the device (roadmap §2.4, silat-rahim-plan): a nickname and a rhythm per relative, never
 * contact details (practice-core `looksLikeContactDetails` through kinship-form.ts). «تواصلت معه» restarts the
 * cycle, «تراجع» removes the last log, «تعديل» reopens the same form (saved with practice-core `updateRelative`,
 * which stamps `updatedAt` so the edit syncs). Due list: overdue / this week / later. Optional reminders: generic
 * text unless the user turns names on.
 */

import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { deleteRelative, dueList, logContact, undoContact, updateRelative, upsertRelative, type DueEntry } from '@thekra/practice-core';
import { shortDate } from '@/lib/practice/format';
import {
  formFromRelative,
  relativeEditFromForm,
  relativeFromForm,
  type RelativeFormError,
  type RelativeFormValues,
  type RhythmChoice,
} from '@/lib/practice/kinship-form';
import { ensurePermission } from '@/lib/practice/notifications';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { TimeField, WeekdayPicker } from '@/components/practice/editors';
import {
  Body,
  Button,
  Card,
  Chip,
  ErrorText,
  Loading,
  Row,
  Screen,
  SectionTitle,
  SwitchRow,
  Wrap,
  practiceStyles,
} from '@/components/practice/ui';


export default function KinshipScreen() {
  const { t } = useTranslation();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const relatives = usePracticeStore((s) => s.store.relatives);
  const prefs = usePracticeStore((s) => s.prefs);
  const setStore = usePracticeStore((s) => s.setStore);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const signedIn = useAuthStore((s) => Boolean(s.user));

  if (!hydrated) return <Loading />;
  const d = today();
  const due = dueList(relatives, d);

  async function toggleReminders(on: boolean) {
    if (on && !(await ensurePermission(t('practice.notify.channelName')))) {
      Alert.alert(t('practice.permissionDenied'));
      return;
    }
    setPrefs((p) => ({ ...p, kinshipReminders: on }));
  }



  function remove(id: string) {
    // Signed in, the deletion syncs to the account (a tombstone), so it is not only «على هذا الجهاز».
    Alert.alert(t('kinship.delete'), t(signedIn ? 'kinship.deleteConfirmSynced' : 'kinship.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => setStore((s) => deleteRelative(s, id)),
      },
    ]);
  }

  const section = (title: string, entries: DueEntry[]) =>
    entries.length > 0 ? (
      <View style={{ gap: 8 }}>
        <SectionTitle>{title}</SectionTitle>
        {entries.map((e) =>
          editingId === e.relative.id ? (
            <RelativeForm
              key={e.relative.id}
              initial={formFromRelative(e.relative)}
              onCancel={() => setEditingId(null)}
              submit={(values) => {
                const res = relativeEditFromForm(values, e.relative, today());
                if (!res.ok) return res.error;
                setStore((s) => updateRelative(s, e.relative.id, () => res.relative));
                setEditingId(null);
                return null;
              }}
            />
          ) : (
            <RelativeCard
              key={e.relative.id}
              entry={e}
              onContacted={() => setStore((s) => updateRelative(s, e.relative.id, (r) => logContact(r, d)))}
              onUndo={() => setStore((s) => undoContact(s, e.relative.id))}
              onEdit={() => {
                setAdding(false);
                setEditingId(e.relative.id);
              }}
              onDelete={() => remove(e.relative.id)}
            />
          ),
        )}
      </View>
    ) : null;

  return (
    <Screen>
      <Card tone="info">
        <Body small>{t('kinship.privacy')}</Body>
        <Body small muted>
          {t('practice.basis.organizational')}
        </Body>
      </Card>

      {adding ? (
        <RelativeForm
          onCancel={() => setAdding(false)}
          submit={(values) => {
            const res = relativeFromForm(values, newPracticeId(), today());
            if (!res.ok) return res.error;
            setStore((s) => upsertRelative(s, res.relative));
            setAdding(false);
            return null;
          }}
        />
      ) : (
        <Button
          label={t('kinship.add')}
          onPress={() => {
            setEditingId(null);
            setAdding(true);
          }}
          variant="outline"
        />
      )}

      {relatives.length === 0 ? <Body muted>{t('kinship.empty')}</Body> : null}
      {section(t('kinship.overdue'), due.overdue)}
      {section(t('kinship.thisWeek'), due.thisWeek)}
      {section(t('kinship.later'), due.later)}

      <SectionTitle>{t('practice.reminders')}</SectionTitle>
      <Card>
        <SwitchRow label={t('kinship.reminders')} value={prefs.kinshipReminders} onValueChange={(v) => void toggleReminders(v)} />
        {prefs.kinshipReminders ? (
          <>
            <SwitchRow
              label={t('kinship.showNames')}
              hint={t('kinship.showNamesHint')}
              value={prefs.kinshipShowNames}
              onValueChange={(v) => setPrefs((p) => ({ ...p, kinshipShowNames: v }))}
            />
            <TimeField
              label={t('kinship.time')}
              value={prefs.kinshipTime}
              onChange={(time) => setPrefs((p) => ({ ...p, kinshipTime: time }))}
            />
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

function RelativeCard({
  entry,
  onContacted,
  onUndo,
  onEdit,
  onDelete,
}: {
  entry: DueEntry;
  onContacted: () => void;
  onUndo: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { relative, nextDue, daysUntilDue } = entry;
  const dueText =
    daysUntilDue < 0
      ? t('kinship.overdueBy', { n: String(-daysUntilDue) })
      : daysUntilDue === 0
        ? t('kinship.dueToday')
        : t('kinship.dueOn', { date: shortDate(nextDue) });
  return (
    <Card>
      <Body>
        {relative.name}
        {relative.relation ? ` · ${relative.relation}` : ''}
      </Body>
      <Body muted small>
        {dueText}
      </Body>
      <Body muted small>
        {relative.lastContactedOn ? t('kinship.lastContact', { date: shortDate(relative.lastContactedOn) }) : t('kinship.never')}
      </Body>
      <Row style={{ flexWrap: 'wrap' }}>
        <Button label={t('kinship.contacted')} onPress={onContacted} compact />
        {relative.history.length > 0 ? <Button label={t('kinship.undo')} onPress={onUndo} variant="outline" compact /> : null}
        <Button label={t('kinship.edit')} onPress={onEdit} variant="outline" compact />
        <Button label={t('kinship.delete')} onPress={onDelete} variant="ghost" compact />
      </Row>
    </Card>
  );
}

/** The add and edit form. `submit` saves and returns null, or returns the form error to show. */
function RelativeForm({
  initial,
  submit,
  onCancel,
}: {
  initial?: RelativeFormValues;
  submit: (values: RelativeFormValues) => RelativeFormError | null;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [relation, setRelation] = useState(initial?.relation ?? '');
  const [rhythm, setRhythm] = useState<RhythmChoice>(initial?.rhythm ?? 'weekly');
  const [weekday, setWeekday] = useState(initial?.weekday ?? 5);
  const [everyDays, setEveryDays] = useState(initial?.everyDays ?? 10);
  const [error, setError] = useState<RelativeFormError | null>(null);

  function save() {
    setError(submit({ name, relation, rhythm, weekday, everyDays }));
  }

  return (
    <Card>
      <Body>{t('kinship.name')}</Body>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder={t('kinship.namePlaceholder')}
        style={practiceStyles.input}
        maxLength={60}
        autoCorrect={false}
        textContentType="none"
        autoComplete="off"
        accessibilityLabel={t('kinship.name')}
      />
      <Body>{t('kinship.relation')}</Body>
      <TextInput
        value={relation}
        onChangeText={(v) => {
          setRelation(v);
          setError(null);
        }}
        placeholder={t('kinship.relationPlaceholder')}
        style={practiceStyles.input}
        maxLength={40}
        autoComplete="off"
        accessibilityLabel={t('kinship.relation')}
      />
      <Body>{t('kinship.rhythm')}</Body>
      <Wrap>
        {(['weekly', 'biweekly', 'monthly', 'everyNDays'] as const).map((r) => (
          <Chip
            key={r}
            label={t(`kinship.rhythm${r.charAt(0).toUpperCase()}${r.slice(1)}`)}
            selected={rhythm === r}
            onPress={() => setRhythm(r)}
          />
        ))}
      </Wrap>
      {rhythm === 'weekly' || rhythm === 'biweekly' ? (
        <>
          <Body small muted>
            {t('kinship.weekday')}
          </Body>
          <WeekdayPicker value={[weekday]} onChange={(v) => setWeekday(v[0] ?? 5)} single />
        </>
      ) : null}
      {rhythm === 'everyNDays' ? (
        <Wrap>
          {[3, 7, 10, 14, 21].map((n) => (
            <Chip key={n} label={t('kinship.everyDays', { n: String(n) })} selected={everyDays === n} onPress={() => setEveryDays(n)} />
          ))}
        </Wrap>
      ) : null}
      {error ? <ErrorText>{t(`kinship.errors.${error}`)}</ErrorText> : null}
      <Row>
        <Button label={t('kinship.save')} onPress={save} compact />
        <Button label={t('kinship.cancel')} onPress={onCancel} variant="ghost" compact />
      </Row>
    </Card>
  );
}
