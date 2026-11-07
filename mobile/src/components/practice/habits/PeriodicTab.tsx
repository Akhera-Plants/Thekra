/**
 * «عاداتي › الدورية» (owner round 5, §1 IA; F-14, F-15): every periodic act, soonest first (people lists: each list is
 * one act, edited on «أهلي وناسي»; the dated acts open their plan), with «أضف» on the title's line (the catalog's
 * periodic templates; 7 at most, past it the limit sheet) and the entry to «أهلي وناسي». Reminders only: no commitment
 * tracking here.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HeartHandshake, Plus, Repeat } from 'lucide-react-native';
import type { LocalDate } from '@thekra/practice-core';
import { useLimits, usePeriodicRows } from '@/lib/practice/use-habits-hub';
import { AddSheet } from '@/components/practice/hub/AddSheet';
import { PeriodicRows } from '@/components/practice/hub/PeriodicRows';
import { space, useStyles, type Theme } from '@/theme';
import { Button, EmptyState, ListRow, Section, SectionDivider, Text } from '@/ui';

const makeStyles = (_t: Theme) => ({
  root: { gap: space['2xl'] },
});

export function PeriodicTab({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const rows = usePeriodicRows(today);
  const limits = useLimits();
  const [adding, setAdding] = useState(false);
  return (
    <View style={styles.root}>
      <Section
        title={t('practice.periodic.title')}
        lead={t('practice.periodic.lead')}
        action={rows.length > 0 ? <Button label={t('kinship.addShort')} icon={Plus} variant="outline" size="sm" onPress={() => setAdding(true)} accessibilityLabel={t('practice.periodic.add')} /> : undefined}
      >
        {rows.length === 0 ? (
          <EmptyState icon={Repeat} message={t('practice.periodic.empty')} actionLabel={t('practice.periodic.add')} onAction={() => setAdding(true)} />
        ) : (
          <>
            <PeriodicRows rows={rows} />
            <Text variant="caption" tone="muted">
              {t('practice.periodic.count', { n: limits.periodic.count, max: limits.periodic.max })}
            </Text>
          </>
        )}
      </Section>
      <SectionDivider />
      <ListRow icon={HeartHandshake} title={t('more.items.people')} hint={t('habitsTab.periodic.peopleHint')} chevron last onPress={() => router.push('/practice/kinship')} />
      <AddSheet visible={adding} periodic onClose={() => setAdding(false)} />
    </View>
  );
}
