/**
 * «أعمال دورية»: every act that does not repeat each day, soonest first: relatives (صلة الرحم; added and edited on
 * the kinship page) and the habits whose rule is not daily (each opens its plan, where its days are set). «أضف عملًا
 * دوريًا» offers the two kinds. Reached from «ورد اليوم» («الكل») and from «سجلّي».
 */

import React, { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus, Repeat } from 'lucide-react-native';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { usePeriodicRows } from '@/lib/practice/use-habits-hub';
import { AddSheet } from '@/components/practice/hub/AddSheet';
import { PeriodicRows } from '@/components/practice/hub/PeriodicRows';
import { Button, EmptyState, PageHeader, Screen, Section, TextLink } from '@/ui';

const openKinship = () => router.push('/practice/kinship');

export default function PeriodicScreen() {
  const { t } = useTranslation();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const rows = usePeriodicRows(today());
  const [adding, setAdding] = useState(false);
  const handleOpen = useCallback(() => setAdding(true), []);
  const handleClose = useCallback(() => setAdding(false), []);

  const relatives = rows.filter((r) => r.act.kind === 'relative');
  const habits = rows.filter((r) => r.act.kind === 'habit');

  return (
    <Screen edges={['bottom']} decor>
      <PageHeader title={t('practice.periodic.title')} lead={t('practice.periodic.lead')} />

      {hydrated && rows.length === 0 ? (
        <EmptyState icon={Repeat} message={t('practice.periodic.empty')} actionLabel={t('practice.periodic.add')} onAction={handleOpen} />
      ) : (
        <Button label={t('practice.periodic.add')} icon={Plus} onPress={handleOpen} variant="outline" />
      )}

      {relatives.length > 0 ? (
        <Section title={t('kinship.title')}>
          <PeriodicRows rows={relatives} />
          <TextLink label={t('practice.periodic.manageKinship')} onPress={openKinship} />
        </Section>
      ) : null}

      {habits.length > 0 ? (
        <Section title={t('practice.periodic.habitsTitle')}>
          <PeriodicRows rows={habits} />
        </Section>
      ) : null}

      <AddSheet visible={adding} onClose={handleClose} periodic />
    </Screen>
  );
}
