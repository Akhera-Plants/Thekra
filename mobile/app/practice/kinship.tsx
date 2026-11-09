/**
 * «صلة الرحم والأحباب» (owner round 6, §6; C-05, C-10, C-01i): the detail of ONE periodic act inside «الأعمال
 * الدورية». «أهلي وناسي» does not exist any more: its people lists live HERE, inside the act, never as a page, menu
 * entry or tab of their own (the route `/practice/kinship` is kept so older links, notifications and the garden still
 * land; the data is the same `Relative` rows, nothing migrates). A nickname and a rhythm per person, never contact
 * details (practice-core `looksLikeContactDetails` through kinship-form.ts). Top to bottom: «هذا الأسبوع» (everyone due
 * or overdue, from every list), then one section per list — الأقارب، الوالدان، الجيران، الأصدقاء، المرضى — each with
 * «أضف» on its title line. A row has «تواصلت معه» («تراجع» in the toast); its «⋯» holds «عدّل» (the form in a sheet)
 * and «احذف» (confirmed there). The act counts once toward the 7 periodic acts (practice-core `periodicActKeyOf`).
 * `?circle=` and `?add=1` open that list's form at once.
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react-native';
import {
  circleOf,
  deleteRelative,
  dueList,
  isRelativeOpen,
  logContact,
  PEOPLE_CIRCLES,
  undoContact,
  updateRelative,
  upsertRelative,
  type DueEntry,
  type PeopleCircle,
  type Relative,
} from '@thekra/practice-core';
import { useLimits, useShortDate } from '@/lib/practice/use-habits-hub';
import { LimitSheet } from '@/components/practice/LimitSheet';
import { editedRelative, relativeFromForm, type RelativeFormValues } from '@/lib/practice/kinship-form';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RelativeForm } from '@/components/practice/RelativeForm';
import { space, useStyles, type Theme } from '@/theme';
import { ActionMenu, BottomSheet, Button, Loading, PageHeader, Screen, SectionDivider, SectionHeader, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  section: { gap: space.xs },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
});

/** The sections in the plan's order (F-15 a). */
const ORDER: readonly PeopleCircle[] = ['kin', 'parents', 'neighbors', 'friends', 'sick'];

export default function SilatScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const relatives = usePracticeStore((s) => s.store.relatives);
  const setStore = usePracticeStore((s) => s.setStore);
  const { add, circle: circleParam } = useLocalSearchParams<{ add?: string; circle?: string }>();
  const asked = PEOPLE_CIRCLES.includes(circleParam as PeopleCircle) ? (circleParam as PeopleCircle) : null;
  const planLimits = useLimits();
  const [limitOpen, setLimitOpen] = useState(false);
  // The form sheet: a list to add to, or a person to edit.
  const [adding, setAdding] = useState<PeopleCircle | null>(asked && (add === '1' || !relatives.some((r) => circleOf(r) === asked)) ? asked : null);
  const [editing, setEditing] = useState<Relative | null>(null);
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const d = today();
  const due = useMemo(() => dueList(relatives, d), [relatives, d]);
  const nowDue = [...due.overdue, ...due.thisWeek];
  const nowIds = new Set(nowDue.map((e) => e.relative.id));
  const entryById = new Map([...due.overdue, ...due.thisWeek, ...due.later].map((e) => [e.relative.id, e]));

  if (!hydrated) return <Loading />;

  function remove(rel: Relative) {
    setStore((s) => deleteRelative(s, rel.id));
    toast(t('habitsTab.people.deletedToast', { name: rel.name }));
  }

  function saveNew(circle: PeopleCircle, values: RelativeFormValues) {
    // A new list is one more periodic act (7 at most); a person added to a list in use adds none.
    if (!planLimits.canAdd('periodic', { circle })) {
      setAdding(null);
      setLimitOpen(true);
      return null;
    }
    const res = relativeFromForm(values, newPracticeId(), today(), circle);
    if (!res.ok) return res.error;
    setStore((s) => upsertRelative(s, res.relative));
    setAdding(null);
    toast(t('kinship.addedToast', { name: res.relative.name }));
    return null;
  }

  function saveEdit(rel: Relative, values: RelativeFormValues) {
    const res = editedRelative(rel, values, today());
    if (!res.ok) return res.error;
    setStore((s) => updateRelative(s, rel.id, () => res.relative));
    setEditing(null);
    toast(t('kinship.savedToast'));
    return null;
  }

  function contacted(rel: Relative) {
    setStore((s) => updateRelative(s, rel.id, (r) => logContact(r, d)));
    toast({
      message: t('kinship.contactedToast', { name: rel.name }),
      actionLabel: t('kinship.undo'),
      onAction: () => setStore((s) => undoContact(s, rel.id)),
    });
  }

  const row = (rel: Relative, last: boolean) => (
    <PersonRow
      key={rel.id}
      relative={rel}
      entry={entryById.get(rel.id)}
      today={d}
      last={last}
      signedIn={signedIn}
      onContacted={() => contacted(rel)}
      onEdit={() => setEditing(rel)}
      onDelete={() => remove(rel)}
    />
  );

  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader eyebrow={t('habitsTab.tabs.periodic')} title={t('habitsHub.periodic.silat')} lead={t('habitsHub.periodic.silatLead')} />

      {nowDue.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title={t('kinship.thisWeek')} />
          <View>{nowDue.map((e, i) => row(e.relative, i === nowDue.length - 1))}</View>
        </View>
      ) : null}

      {ORDER.map((circle, ci) => {
        const people = relatives.filter((r) => circleOf(r) === circle && !nowIds.has(r.id));
        const all = relatives.filter((r) => circleOf(r) === circle);
        return (
          <React.Fragment key={circle}>
            {ci > 0 || nowDue.length > 0 ? <SectionDivider /> : null}
            <View style={styles.section}>
              <SectionHeader
                title={t(`habitsTab.people.circles.${circle}`)}
                lead={all.length === 0 ? t(`practice.circles.${circle}.hint`) : undefined}
                action={
                  <Button
                    label={t('kinship.addShort')}
                    icon={Plus}
                    variant="outline"
                    size="sm"
                    onPress={() => setAdding(circle)}
                    accessibilityLabel={`${t('kinship.addShort')}: ${t(`habitsTab.people.circles.${circle}`)}`}
                  />
                }
              />
              {people.length > 0 ? <View>{people.map((r, i) => row(r, i === people.length - 1))}</View> : null}
            </View>
          </React.Fragment>
        );
      })}

      <BottomSheet
        visible={adding !== null || editing !== null}
        title={editing ? t('kinship.editTitle') : adding ? t('habitsTab.people.addTo', { list: t(`habitsTab.people.circles.${adding}`) }) : ''}
        onClose={() => {
          setAdding(null);
          setEditing(null);
        }}
      >
        {editing ? (
          <RelativeForm
            title={editing.name}
            relative={editing}
            noRhythm={circleOf(editing) === 'sick'}
            onSave={(values) => saveEdit(editing, values)}
            onCancel={() => setEditing(null)}
          />
        ) : adding ? (
          <RelativeForm title={t('kinship.privacy')} noRhythm={adding === 'sick'} onSave={(values) => saveNew(adding, values)} onCancel={() => setAdding(null)} />
        ) : null}
      </BottomSheet>

      <LimitSheet kind="periodic" visible={limitOpen} limits={planLimits} onClose={() => setLimitOpen(false)} onFreed={() => setLimitOpen(false)} />
    </Screen>
  );
}

interface PersonRowProps {
  relative: Relative;
  entry: DueEntry | undefined;
  today: string;
  last: boolean;
  signedIn: boolean;
  onContacted: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Name · relation and the due line; «تواصلت معه» (or «تواصلت اليوم»), then «⋯» with «عدّل» and «احذف». */
function PersonRow({ relative, entry, today: d, last, signedIn, onContacted, onEdit, onDelete }: PersonRowProps) {
  const shortDate = useShortDate();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const open = isRelativeOpen(relative);
  const dueText = !open
    ? t('practice.circles.sick.visited')
    : !entry
      ? ''
      : entry.daysUntilDue < 0
        ? t('kinship.overdueBy', { count: -entry.daysUntilDue })
        : entry.daysUntilDue === 0
          ? t('kinship.dueToday')
          : t('kinship.dueOn', { date: shortDate(entry.nextDue) });
  const lastText = relative.lastContactedOn ? t('kinship.lastContact', { date: shortDate(relative.lastContactedOn) }) : t('kinship.never');
  const contactedToday = relative.lastContactedOn === d;
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowText}>
        <Text variant="body" weight="medium">
          {relative.name}
          {relative.relation ? (
            <Text variant="small" tone="muted">
              {` · ${relative.relation}`}
            </Text>
          ) : null}
        </Text>
        <Text variant="caption" tone="muted">
          {[dueText, lastText].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {open ? (
        <Button
          label={contactedToday ? t('kinship.contactedToday') : t('kinship.contacted')}
          icon={contactedToday ? Check : undefined}
          onPress={onContacted}
          disabled={contactedToday}
          variant="outline"
          size="sm"
          accessibilityLabel={`${t('kinship.contacted')}: ${relative.name}`}
        />
      ) : null}
      <ActionMenu
        label={t('kinship.edit', { name: relative.name })}
        items={[
          { label: t('habitsTab.plan.edit'), icon: Pencil, onPress: onEdit },
          {
            label: t('kinship.delete'),
            icon: Trash2,
            destructive: true,
            onPress: onDelete,
            confirm: {
              title: t('habitsTab.people.deleteTitle', { name: relative.name }),
              message: t(signedIn ? 'kinship.deleteConfirmSynced' : 'kinship.deleteConfirm'),
              confirmLabel: t('common.delete'),
            },
          },
        ]}
      />
    </View>
  );
}
