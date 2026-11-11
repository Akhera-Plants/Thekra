/**
 * «عمل من عندك» (owner round 6, C-10: «اسمحله هو يضيف هون وتذكره فيها»): the member's own periodic act — a name, a
 * rhythm that is not daily (weekly days, every n days, or a day of the month) and the reminder times. A new act is
 * practice-core `createCustomPeriodic` (always periodic: outside the habits, the streak and the commitment); `?id=`
 * edits one (its name, rhythm and times). Saving toasts and returns to «الأعمال الدورية»; deleting is the trash icon on
 * its row there.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  createCustomPeriodic,
  isCustomPeriodic,
  orderedSlots,
  slotChoices,
  updatePlan,
  upsertPlan,
  validatePlan,
  weekday,
  type Plan,
  LIMITS,
} from '@thekra/practice-core';
import { SlotsEditor, WeekdayPicker, type SlotChoice } from '@/components/practice/editors';
import { CUSTOM_RHYTHMS, customRhythmOf, customRule, type CustomRhythm, type CustomRhythmValues } from '@/lib/practice/hub-view';
import { parseLogAmount } from '@/lib/practice/format';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { useLimits } from '@/lib/practice/use-habits-hub';
import { space, useStyles } from '@/theme';
import { ButtonPair, ErrorText, Field, Loading, Notice, PageHeader, Screen, SectionDivider, SegmentTabs, Text, toast } from '@/ui';

const makeStyles = () => ({
  group: { gap: space.md },
  num: { writingDirection: 'ltr' as const, textAlign: 'center' as const },
});

export default function CustomPeriodicScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const limits = useLimits();
  const existing = id ? plans.find((p) => p.id === id && isCustomPeriodic(p)) : undefined;
  const d = today();
  const [name, setName] = useState(existing?.title ?? '');
  const [values, setValues] = useState<CustomRhythmValues>(() => customRhythmOf(existing?.rule, weekday(d)));
  const [slots, setSlots] = useState<SlotChoice[]>(existing ? slotChoices(existing) : ['20:00']);
  const [error, setError] = useState<string | null>(null);
  if (!hydrated) return <Loading />;
  const full = !existing && !limits.canAdd('periodic');

  function save() {
    setError(null);
    const title = name.trim();
    if (!title) return setError(t('habitsHub.custom.nameError'));
    const rule = customRule(values, d);
    if (!rule) return setError(t('habitsHub.custom.rhythmError'));
    if (slots.length === 0) return setError(t('practice.add.noSlots'));
    const ordered = orderedSlots(slots);
    if (existing) {
      const next: Plan = { ...existing, title, rule, slots: ordered.slots };
      if (ordered.slotAnchors) next.slotAnchors = ordered.slotAnchors;
      else delete next.slotAnchors;
      if (validatePlan(next) !== null) return setError(t('habitsHub.custom.rhythmError'));
      setStore((s) => updatePlan(s, existing.id, () => next));
      toast(t('habitsHub.custom.savedToast', { act: title }));
    } else {
      let plan: Plan;
      try {
        plan = createCustomPeriodic({ id: newPracticeId(), title, rule, slots: ordered.slots, slotAnchors: ordered.slotAnchors, createdOn: d });
      } catch {
        return setError(t('habitsHub.custom.rhythmError'));
      }
      setStore((s) => upsertPlan(s, plan));
      toast(t('habitsHub.custom.addedToast', { act: title }));
    }
    if (router.canGoBack()) router.back();
    else router.replace('/habits?tab=periodic');
  }

  const setRhythm = (rhythm: CustomRhythm) => setValues((v) => ({ ...v, rhythm }));
  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader title={existing ? t('habitsHub.custom.editTitle') : t('habitsHub.periodic.custom')} lead={t('habitsHub.custom.lead')} />
      {full ? <Notice>{t('habitsHub.periodic.full', { max: LIMITS.periodic })}</Notice> : null}
      <Field label={t('habitsHub.custom.name')} placeholder={t('habitsHub.custom.namePlaceholder')} value={name} onChangeText={setName} maxLength={200} />
      <View style={styles.group}>
        <Text variant="heading" accessibilityRole="header">
          {t('habitsHub.custom.rhythm')}
        </Text>
        <SegmentTabs items={CUSTOM_RHYTHMS.map((r) => ({ key: r, label: t(`habitsHub.custom.rhythms.${r}`) }))} value={values.rhythm} onChange={setRhythm} />
        {values.rhythm === 'weekly' ? (
          <WeekdayPicker value={values.days} onChange={(days) => setValues((v) => ({ ...v, days }))} />
        ) : values.rhythm === 'everyNDays' ? (
          <Field
            label={t('habitsHub.custom.everyN')}
            value={String(values.n)}
            onChangeText={(v) => setValues((old) => ({ ...old, n: parseLogAmount(v) ?? 0 }))}
            keyboardType="number-pad"
            maxLength={3}
            style={styles.num}
          />
        ) : (
          <Field
            label={t('habitsHub.custom.monthDay')}
            value={String(values.day)}
            onChangeText={(v) => setValues((old) => ({ ...old, day: parseLogAmount(v) ?? 0 }))}
            keyboardType="number-pad"
            maxLength={2}
            style={styles.num}
          />
        )}
      </View>
      <SectionDivider />
      <View style={styles.group}>
        <Text variant="heading" accessibilityRole="header">
          {t('habitsHub.custom.reminders')}
        </Text>
        <SlotsEditor slots={slots} onChange={setSlots} />
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <ButtonPair size="lg" primary={{ label: t('habitsHub.custom.save'), onPress: save, disabled: full }} secondary={{ label: t('common.cancel'), onPress: () => router.back() }} />
    </Screen>
  );
}
