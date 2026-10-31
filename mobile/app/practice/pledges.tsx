/**
 * «التزام شخصي» (redesign §4.4, opt-in from «نية اليوم والمحاسبة» in Settings): one pledge per habit, «إن فاتتني يومين
 * متتاليين: [أتصدق بـ… / أصلي ركعتين / نص أكتبه]». Device-local (practice-store `heart`). Never called a penalty.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addPledge, removePledge, type PledgeAction } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { pledgeWords, planTitleOf } from '@/components/practice/hub/HeartCards';
import { space, useStyles, type Theme } from '@/theme';
import { Button, CheckRow, Chip, Field, PageHeader, Screen, Section, Text, TextLink } from '@/ui';

type T = (key: string, opts?: Record<string, unknown>) => string;

const makeStyles = (t: Theme) => ({
  row: { paddingVertical: space.sm, gap: space.xs, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  stack: { gap: space.md },
});

export default function PledgesScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const plans = usePracticeStore((s) => s.store.plans);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const [planId, setPlanId] = useState<string | null>(null);
  const [action, setAction] = useState<PledgeAction>('rakatain');
  const [text, setText] = useState('');
  const chosen = planId ?? plans[0]?.id ?? null;
  const needsText = action === 'custom' && text.trim() === '';

  function add() {
    if (!chosen || needsText) return;
    setHeart((h) => addPledge(h, { id: newPracticeId(), planId: chosen, action, text, createdOn: today() }));
    setText('');
  }

  return (
    <Screen edges={['bottom']} keyboard decor>
      <PageHeader title={t('practice.notifyPrefs.pledges')} lead={t('practice.notifyPrefs.pledgesHint')} />
      <Section>
        {heart.pledges.length === 0 ? (
          <Text variant="body" tone="muted">
            {t('practice.notifyPrefs.pledgeNone')}
          </Text>
        ) : (
          heart.pledges.map((pledge) => {
            const plan = plans.find((p) => p.id === pledge.planId);
            return (
              <View key={pledge.id} style={styles.row}>
                <Text variant="body" weight="medium">
                  {plan ? planTitleOf(plan, habits, locale) : ''}
                </Text>
                <Text variant="small" tone="muted">
                  {pledgeWords(pledge, t as unknown as T)}
                </Text>
                <TextLink label={t('practice.notifyPrefs.pledgeRemove')} onPress={() => setHeart((h) => removePledge(h, pledge.id))} />
              </View>
            );
          })
        )}
      </Section>
      <Section title={t('practice.notifyPrefs.pledgeAdd')}>
        {plans.length === 0 ? (
          <Text variant="body" tone="muted">
            {t('practice.notifyPrefs.noHabits')}
          </Text>
        ) : (
          <View style={styles.stack}>
            <Text variant="label">{t('practice.notifyPrefs.pledgeHabit')}</Text>
            <View style={styles.chips}>
              {plans.map((p) => (
                <Chip key={p.id} label={planTitleOf(p, habits, locale)} selected={chosen === p.id} onPress={() => setPlanId(p.id)} />
              ))}
            </View>
            <Text variant="label">{t('practice.notifyPrefs.pledgeIf')}</Text>
            {(
              [
                ['sadaqah', 'pledgeSadaqah'],
                ['rakatain', 'pledgeRakatain'],
                ['custom', 'pledgeCustom'],
              ] as const
            ).map(([key, label]) => (
              <CheckRow key={key} radio title={t(`practice.notifyPrefs.${label}`)} checked={action === key} onPress={() => setAction(key)} />
            ))}
            {action !== 'rakatain' ? (
              <Field label={t('practice.notifyPrefs.pledgeText')} value={text} maxLength={140} onChangeText={setText} />
            ) : null}
            <Button label={t('practice.notifyPrefs.pledgeAdd')} onPress={add} disabled={needsText} />
          </View>
        )}
      </Section>
    </Screen>
  );
}
