/**
 * «الفرائض» on «ورد اليوم» (owner round 5, F-05 a): opt-in rows for the five prayers, each with «في وقتها» and «قضاء»
 * (a second tap on the chosen one clears it). Not a habit: outside the limit of 3, the streak and the reminders
 * (practice-core `fard.ts`). The section title carries «المعينات» (FARD_EVIDENCE, public Quote ids read from the API) and
 * the «⋯» with the switch that hides the section (it is turned on again from «أضف» or the onboarding). No blame words:
 * an empty prayer is just empty.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BookOpenText, EyeOff } from 'lucide-react-native';
import { FARD_EVIDENCE, FARD_LABELS, FARD_PRAYERS, fardOn, setFard, setFardTracking, type FardStatus, type LocalDate } from '@thekra/practice-core';
import { useEvidence } from '@/lib/api/practice';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { space, useStyles, type Theme } from '@/theme';
import { ActionMenu, BottomSheet, Chip, IconButton, SectionHeader, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  root: { gap: space.xs },
  actions: { flexDirection: 'row' as const, alignItems: 'center' as const },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 56,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  last: { borderBottomWidth: 0 },
  name: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row' as const, gap: space.sm },
});

export function FardSection({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidence = useEvidence(evidenceOpen ? FARD_EVIDENCE : [], locale);
  const labels = FARD_LABELS[locale];
  const marks = fardOn(store, today);

  function mark(prayer: (typeof FARD_PRAYERS)[number], status: FardStatus) {
    const next = marks[prayer] === status ? null : status;
    setStore((s) => setFard(s, { date: today, prayer, status: next, today }));
  }

  return (
    <View style={styles.root}>
      <SectionHeader
        title={labels.title}
        action={
          <View style={styles.actions}>
            <IconButton icon={BookOpenText} label={t('habitsTab.fard.evidence')} tone="link" onPress={() => setEvidenceOpen(true)} />
            <ActionMenu
              items={[
                {
                  label: t('habitsTab.fard.off'),
                  icon: EyeOff,
                  hint: t('habitsTab.fard.offHint'),
                  onPress: () => {
                    setStore((s) => setFardTracking(s, false));
                    toast(t('habitsTab.fard.offToast'));
                  },
                },
              ]}
            />
          </View>
        }
      />
      <View>
        {FARD_PRAYERS.map((prayer, i) => (
          <View key={prayer} style={[styles.row, i === FARD_PRAYERS.length - 1 && styles.last]}>
            <Text variant="body" weight="medium" style={styles.name}>
              {labels.prayers[prayer]}
            </Text>
            <View style={styles.chips}>
              <Chip label={t('habitsTab.fard.onTime')} selected={marks[prayer] === 'onTime'} onPress={() => mark(prayer, 'onTime')} />
              <Chip label={t('habitsTab.fard.qada')} selected={marks[prayer] === 'qada'} onPress={() => mark(prayer, 'qada')} />
            </View>
          </View>
        ))}
      </View>
      <BottomSheet visible={evidenceOpen} title={t('habitsTab.fard.evidence')} onClose={() => setEvidenceOpen(false)}>
        <EvidenceList ids={FARD_EVIDENCE} byId={evidence.data} loading={evidence.isLoading} error={evidence.isError} title="" />
      </BottomSheet>
    </View>
  );
}
