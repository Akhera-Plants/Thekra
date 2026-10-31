/**
 * The bridges from a topic page to the practice tools (owner: «at every good deed, the option to make it a habit;
 * at every sin, to start leaving it»), read from the practice catalog the hub already caches:
 * - the good deed's «اجعلها عادتي» is in components/TopicTemplate.tsx (`DeedHabitAction`);
 * - `SinProgramLink`: «ابدأ «تخفَّف»» / «تابع برنامجك» on a sin. The sin goes to the chooser in memory
 *   (`setPendingProgram`), never in the route (roadmap §0.2).
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { isActiveProgram } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { setMomentSource, setPendingProgram, usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { space, useStyles, type Theme } from '@/theme';
import { Button, Text } from '@/ui';

const makeStyles = (_t: Theme) => ({
  program: { gap: space.xs },
});

/**
 * «ابدأ «تخفَّف»» when the catalog has a program for this sin, «تابع برنامجك» when it is already running. Other
 * programs keep running beside it (as on the website): the chooser opens with this sin selected.
 */
export function SinProgramLink({ sin }: { sin: string }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const catalog = usePracticeCatalog(locale);
  const isActive = usePracticeStore((s) => s.store.programs.some((p) => p.sinSlug === sin && isActiveProgram(p)));

  const hasProgram = catalog.data?.sinPrograms.programs.some((p) => p.sin === sin) ?? false;
  if (!hasProgram) return null;

  function handleOpen() {
    if (!isActive) setPendingProgram(sin);
    router.push('/practice/sin-program');
  }

  // «أنا في لحظة ضعف»: shown on every program sin page whatever the device holds, so it tells nothing; the screen
  // uses this sin's program only if the user follows it (in-memory hand-off, never a route param).
  function handleMoment() {
    setMomentSource(sin);
    router.push('/practice/moment');
  }

  return (
    <View style={styles.program}>
      <Button
        label={isActive ? t('reminders.continueProgram') : t('reminders.startProgram')}
        variant="outline"
        arrow
        onPress={handleOpen}
      />
      <Text variant="caption" tone="muted">
        {t('practice.hub.addProgramHint')}
      </Text>
      <Button label={t('sinProgram.moment.openFromSin')} variant="ghost" arrow onPress={handleMoment} />
    </View>
  );
}
