/**
 * «لحظة الضعف» (docs/plan/2026-10-tazkiya-tracker-proposals.md item 3): a full-screen modal with a generic title
 * («وقفة», practice/_layout.tsx) and about 90 calm seconds, one step at a time, each one skippable: breathe, one text,
 * a practical move, «أجّل عشر دقائق», a companion's prayer. Then «تجاوزتها، الحمد لله» (a private mark on this day:
 * «لحظة ضعف عبرتها» in the notebook, never a failure) or «وقعت» (the day's check-in becomes «وقعت ثم تبت» and
 * «أتبِع السيئة الحسنة» follows).
 *
 * LOCAL ONLY (roadmap §0.1, §0.2): the program arrives in memory from the program page (`urgeProgram`), never in the
 * route; opened any other way the modal shows nothing of a program. The texts come from the evidence already fetched
 * for every program at once. SinProgramGuard covers it in the background, blocks screenshots, and locks it after the
 * background when the lock is on (it opens without a second prompt, the program page having just been unlocked).
 * Basis: urges rise and fade within minutes; delaying and moving the body breaks the loop (Marlatt; Bowen).
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react-native';
import { isActiveProgram } from '@thekra/practice-core';
import { usePracticeCatalog, useSinProgramEvidence } from '@/lib/api/practice';
import { pick, type StageContent } from '@/lib/practice/catalog-types';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { withFall, withUrgePassed } from '@/lib/practice/sin-program-view';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { momentTextIds, pickMomentText, setUrgeProgram, URGE_STEPS, urgeProgram } from '@/lib/practice/urge-moment';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { FollowWithGood } from '@/components/practice/FollowWithGood';
import { SinProgramGuard } from '@/components/practice/SinProgramGuard';
import { BreathPacer, CompanionActions, DelayAction, MoveChoices, ProgressDots } from '@/components/practice/UrgeSteps';
import { space, useStyles } from '@/theme';
import { Button, EmptyState, IconButton, Notice, Screen, Text } from '@/ui';

type Ending = 'passed' | 'fell' | null;

const makeStyles = () => ({
  bar: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: space.md },
  block: { gap: space.lg },
  actions: { gap: space.sm, paddingTop: space.md },
  centered: { flexGrow: 1, justifyContent: 'center' as const },
});

function handleClose() {
  router.back();
}

export default function PauseScreen() {
  // Read during render and cleared after mount: the hand-off survives a double render, and never a second opening.
  const [sinSlug] = useState(urgeProgram);
  useEffect(() => setUrgeProgram(null), []);
  return (
    <SinProgramGuard startOpen={sinSlug !== null}>
      <PauseContent sinSlug={sinSlug} />
    </SinProgramGuard>
  );
}

function PauseContent({ sinSlug }: { sinSlug: string | null }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const evidence = useSinProgramEvidence(catalog.data, locale);
  const program = usePracticeStore((s) => s.store.programs.find((p) => p.sinSlug === sinSlug && isActiveProgram(p)));
  const setStore = usePracticeStore((s) => s.setStore);
  const [index, setIndex] = useState(0);
  const [ending, setEnding] = useState<Ending>(null);
  const [date] = useState(today);

  const urge = catalog.data?.sinPrograms.common.urgeMoment;
  const common = catalog.data?.sinPrograms.common;
  const entry = catalog.data?.sinPrograms.programs.find((p) => p.sin === sinSlug);

  if (!program || !urge || !common) {
    return (
      <Screen edges={['top', 'bottom']} contentStyle={styles.centered}>
        <EmptyState message={catalog.isLoading ? t('common.loading') : t('sinProgram.urge.unavailable')} actionLabel={t('common.close')} onAction={handleClose} />
      </Screen>
    );
  }

  const step = URGE_STEPS[index];
  const next = () => setIndex((i) => i + 1);

  function handlePassed() {
    if (!program) return;
    setStore((s) => ({ ...s, programs: withUrgePassed(s.programs, program.sinSlug, date) }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEnding('passed');
  }

  function handleFell() {
    if (!program) return;
    setStore((s) => ({ ...s, programs: withFall(s.programs, program.sinSlug, date) }));
    setEnding('fell');
  }

  const content: Record<(typeof URGE_STEPS)[number], StageContent> = {
    breathe: urge.breathe,
    text: urge.text,
    move: urge.move,
    delay: urge.delay,
    companion: urge.companion,
  };
  const moment = pickMomentText(momentTextIds(urge, entry), evidence.data, date);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.bar}>
        <ProgressDots index={ending ? URGE_STEPS.length : index} total={URGE_STEPS.length + 1} />
        <IconButton icon={X} label={t('common.close')} onPress={handleClose} />
      </View>

      {step && !ending ? (
        <View style={styles.block}>
          <Text variant="title" accessibilityRole="header">
            {pick(content[step], 'title', locale)}
          </Text>
          <Text variant={locale === 'ar' ? 'reading' : 'body'}>{pick(content[step], 'body', locale)}</Text>
          {step === 'breathe' ? <BreathPacer breaths={urge.breathe.breaths} /> : null}
          {step === 'text' ? (
            moment || evidence.isLoading ? (
              <EvidenceList ids={moment ? [moment.id] : momentTextIds(urge, entry)} byId={evidence.data} loading={evidence.isLoading} limit={1} />
            ) : (
              <Notice>{t('sinProgram.urge.noText')}</Notice>
            )
          ) : null}
          {step === 'move' ? <MoveChoices urge={urge} /> : null}
          {step === 'delay' ? <DelayAction minutes={urge.delay.minutes} /> : null}
          {step === 'companion' ? <CompanionActions urge={urge} /> : null}
          <View style={styles.actions}>
            <Button label={t('sinProgram.urge.next')} onPress={next} arrow large />
          </View>
        </View>
      ) : null}

      {!step && !ending ? (
        <View style={styles.block}>
          <Text variant="title" accessibilityRole="header">
            {t('sinProgram.urge.endTitle')}
          </Text>
          <View style={styles.actions}>
            <Button label={t('sinProgram.urge.passed')} icon={Check} onPress={handlePassed} large />
            <Button label={t('sinProgram.urge.fell')} onPress={handleFell} variant="outline" />
          </View>
        </View>
      ) : null}

      {ending === 'passed' ? (
        <View style={styles.block}>
          <Text variant="title" accessibilityRole="header">
            {pick(urge.passed, 'title', locale)}
          </Text>
          <Text variant={locale === 'ar' ? 'reading' : 'body'}>{pick(urge.passed, 'body', locale)}</Text>
          <Notice icon={Check}>{t('sinProgram.urge.passedSaved')}</Notice>
          <Button label={t('sinProgram.urge.back')} onPress={handleClose} variant="outline" />
        </View>
      ) : null}

      {ending === 'fell' && common.followWithGood ? (
        <FollowWithGood
          program={program}
          date={date}
          flow={common.followWithGood}
          intro={common.afterFall}
          evidenceById={evidence.data}
          evidenceLoading={evidence.isLoading}
          evidenceError={evidence.isError}
          onDone={handleClose}
        />
      ) : null}
      {ending === 'fell' && !common.followWithGood ? (
        <View style={styles.block}>
          <Text variant="title" accessibilityRole="header">
            {pick(common.afterFall, 'title', locale)}
          </Text>
          <Text variant={locale === 'ar' ? 'reading' : 'body'}>{pick(common.afterFall, 'body', locale)}</Text>
          <Button label={t('sinProgram.urge.back')} onPress={handleClose} variant="outline" />
        </View>
      ) : null}
    </Screen>
  );
}
