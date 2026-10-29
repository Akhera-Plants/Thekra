/**
 * صلة الرحم, on the device (roadmap §2.4, silat-rahim-plan): a nickname and a rhythm per relative, never
 * contact details (practice-core `looksLikeContactDetails` through kinship-form.ts). «تواصلت معه» restarts the
 * cycle, «تراجع» removes the last log. Due list: overdue / this week / later. Optional reminders: generic
 * text unless the user turns names on. `?add=1` opens the add form directly (the hub's «أضف»).
 *
 * Layout after the website's kinship page: the page title, the add form (a bordered card), the due buckets as
 * hairline-divided lists, then the reminders. A row's edit button opens the same form on that relative in place of
 * the row (name, relation, rhythm), with «حذف» there; deleting asks first (system alert).
 */

import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Plus, Undo2, Users } from 'lucide-react-native';
import { deleteRelative, dueList, logContact, undoContact, updateRelative, upsertRelative, type DueEntry } from '@thekra/practice-core';
import { shortDate } from '@/lib/practice/format';
import { editedRelative, relativeFromForm, type RelativeFormValues } from '@/lib/practice/kinship-form';
import { ensurePermission } from '@/lib/practice/notifications';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { TimeField } from '@/components/practice/editors';
import { RelativeForm } from '@/components/practice/RelativeForm';
import { space, useStyles, type Theme } from '@/theme';
import { Button, EmptyState, IconButton, Loading, Notice, PageHeader, Row, Rule, Screen, Section, SwitchRow, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  row: { paddingVertical: space.lg, gap: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  rowHead: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.sm },
  rowText: { flex: 1, gap: 2 },
  actions: { flexWrap: 'wrap' as const, gap: space.sm },
  editing: { paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border },
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
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!hydrated) return <Loading />;
  const d = today();
  const due = dueList(relatives, d);

  function remove(id: string) {
    Alert.alert(t('kinship.delete'), t('kinship.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setStore((s) => deleteRelative(s, id));
          setEditingId(null);
        },
      },
    ]);
  }

  function saveNew(values: RelativeFormValues) {
    const res = relativeFromForm(values, newPracticeId(), today());
    if (!res.ok) return res.error;
    setStore((s) => upsertRelative(s, res.relative));
    setAdding(false);
    return null;
  }

  function saveEdit(entry: DueEntry, values: RelativeFormValues) {
    const res = editedRelative(entry.relative, values, today());
    if (!res.ok) return res.error;
    setStore((s) => updateRelative(s, entry.relative.id, () => res.relative));
    setEditingId(null);
    return null;
  }

  const bucket = (title: string, entries: DueEntry[]) =>
    entries.length > 0 ? (
      <Section title={title}>
        <View style={styles.list}>
          {entries.map((e) =>
            e.relative.id === editingId ? (
              <View key={e.relative.id} style={styles.editing}>
                <RelativeForm
                  title={t('kinship.editTitle')}
                  relative={e.relative}
                  onSave={(values) => saveEdit(e, values)}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => remove(e.relative.id)}
                />
              </View>
            ) : (
              <RelativeRow
                key={e.relative.id}
                entry={e}
                onContacted={() => setStore((s) => updateRelative(s, e.relative.id, (r) => logContact(r, d)))}
                onUndo={() => setStore((s) => undoContact(s, e.relative.id))}
                onEdit={() => setEditingId(e.relative.id)}
              />
            ),
          )}
        </View>
      </Section>
    ) : null;

  const form = adding ? <RelativeForm title={t('kinship.add')} onSave={saveNew} onCancel={() => setAdding(false)} /> : null;

  return (
    <Screen edges={['bottom']} keyboard decor>
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
  );
}

interface RelativeRowProps {
  entry: DueEntry;
  onContacted: () => void;
  onUndo: () => void;
  onEdit: () => void;
}

/** The website's relative row: name · relation and the due line, an edit button at the end, then «تواصلت معه», «تراجع». */
function RelativeRow({ entry, onContacted, onUndo, onEdit }: RelativeRowProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { relative, nextDue, daysUntilDue } = entry;
  const dueText =
    daysUntilDue < 0
      ? t('kinship.overdueBy', { count: -daysUntilDue })
      : daysUntilDue === 0
        ? t('kinship.dueToday')
        : t('kinship.dueOn', { date: shortDate(nextDue) });
  const lastText = relative.lastContactedOn ? t('kinship.lastContact', { date: shortDate(relative.lastContactedOn) }) : t('kinship.never');
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
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
        <IconButton icon={Pencil} label={t('kinship.edit', { name: relative.name })} onPress={onEdit} />
      </View>
      <Row style={styles.actions}>
        <Button label={t('kinship.contacted')} icon={Check} onPress={onContacted} />
        {relative.history.length > 0 ? <Button label={t('kinship.undo')} icon={Undo2} onPress={onUndo} variant="ghost" /> : null}
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
