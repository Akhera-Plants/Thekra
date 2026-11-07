/**
 * The bridges from a topic page to the practice tools (owner: «at every good deed, the option to make it a habit;
 * at every sin, to start leaving it»), read from the practice catalog the hub already caches:
 * - the good deed's «ابدأ عادة» is in components/TopicTemplate.tsx (`DeedHabitAction`);
 * - `SinProgramStart`: «ابدأ تخفَّف» / «تابع تخفَّف» on EVERY sin (owner, 2026-11-01: a sin without a written program
 *   runs the common five stages), the page's ONE primary action on its title line (owner round 5, F-10 a / A-07).
 *   The sin goes to the chooser in memory (`setPendingProgram`), never in the route (roadmap §0.2);
 * - `SinMomentLink`: «أنا في لحظة مجاهدة», outlined under the tabs: the moment screen with this sin's acts (F-09).
 */

import React from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Waves } from 'lucide-react-native';
import { isActiveProgram } from '@thekra/practice-core';
import { isSignedIn, openSignIn } from '@/lib/auth/require-sign-in';
import { setMomentSource, setPendingProgram, usePracticeStore } from '@/lib/practice/practice-store';
import { Button } from '@/ui';

/**
 * «ابدأ تخفَّف» on every sin, «تابع تخفَّف» when it is already running. Other programs keep running beside it (as on the
 * website): the chooser opens with this sin selected. Practice is for members: a guest signs in first.
 */
export function SinProgramStart({ sin }: { sin: string }) {
  const { t } = useTranslation();
  const isActive = usePracticeStore((s) => s.store.programs.some((p) => p.sinSlug === sin && isActiveProgram(p)));

  function handleOpen() {
    if (!isActive) setPendingProgram(sin);
    if (isSignedIn()) router.push('/practice/sin-program');
    else openSignIn('/practice/sin-program');
  }

  return (
    <Button
      label={isActive ? t('topic.continueLighten') : t('topic.startLighten')}
      variant={isActive ? 'outline' : 'solid'}
      size="sm"
      onPress={handleOpen}
    />
  );
}

/**
 * «أنا في لحظة مجاهدة»: shown on every sin page whatever the device holds, so it tells nothing; the screen shows this
 * sin's acts and uses its program only if the user follows it (in-memory hand-off, never a route param).
 */
export function SinMomentLink({ sin }: { sin: string }) {
  const { t } = useTranslation();

  function handleMoment() {
    setMomentSource(sin);
    if (isSignedIn()) router.push('/practice/moment');
    else openSignIn('/practice/moment');
  }

  return <Button label={t('sinProgram.moment.openFromSin')} icon={Waves} variant="outline" onPress={handleMoment} />;
}
