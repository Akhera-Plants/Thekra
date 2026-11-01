/**
 * The bridges from a topic page to the practice tools (owner: «at every good deed, the option to make it a habit;
 * at every sin, to start leaving it»), read from the practice catalog the hub already caches:
 * - the good deed's «اجعلها عادتي» is in components/TopicTemplate.tsx (`DeedHabitAction`);
 * - `SinProgramLink`: «ابدأ «تخفَّف»» / «تابع برنامجك» on EVERY sin (owner, 2026-11-01: a sin without a written
 *   program runs the common five stages). The sin goes to the chooser in memory (`setPendingProgram`), never in the
 *   route (roadmap §0.2).
 */

import React from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { isActiveProgram } from '@thekra/practice-core';
import { isSignedIn, openSignIn } from '@/lib/auth/require-sign-in';
import { setMomentSource, setPendingProgram, usePracticeStore } from '@/lib/practice/practice-store';
import { space, useStyles, type Theme } from '@/theme';
import { Button, Wrap } from '@/ui';

const makeStyles = (_t: Theme) => ({
  program: { gap: space.sm },
});

/**
 * «ابدأ «تخفَّف»» on every sin, «تابع برنامجك» when it is already running. Other programs keep running beside it (as on
 * the website): the chooser opens with this sin selected. Practice is for members: a guest signs in first.
 */
export function SinProgramLink({ sin }: { sin: string }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const isActive = usePracticeStore((s) => s.store.programs.some((p) => p.sinSlug === sin && isActiveProgram(p)));

  function handleOpen() {
    if (!isActive) setPendingProgram(sin);
    if (isSignedIn()) router.push('/practice/sin-program');
    else openSignIn('/practice/sin-program');
  }

  // «أنا في لحظة ضعف»: shown on every program sin page whatever the device holds, so it tells nothing; the screen
  // uses this sin's program only if the user follows it (in-memory hand-off, never a route param).
  function handleMoment() {
    setMomentSource(sin);
    if (isSignedIn()) router.push('/practice/moment');
    else openSignIn('/practice/moment');
  }

  return (
    <Wrap style={styles.program}>
      <Button label={isActive ? t('reminders.continueProgram') : t('reminders.startProgram')} arrow onPress={handleOpen} />
      <Button label={t('sinProgram.moment.openFromSin')} variant="ghost" onPress={handleMoment} />
    </Wrap>
  );
}
