/**
 * The bridges from a topic page to the practice tools (owner: «at every good deed, the option to make it a habit;
 * at every sin, to start leaving it»), read from the practice catalog the hub already caches:
 * - the good deed's «ابدأ عادة» is in components/TopicTemplate.tsx (`DeedHabitAction`);
 * - `SinProgramStart`: «تخفّف من هذه المعصية» on EVERY sin (owner, 2026-11-01: a sin without a written program runs
 *   the common five stages), or — once its program runs — its state, as on the website: «مقفل ✓» while «تخفّف» is
 *   locked, «في خطتك» while it is open (round 6, C-15), the page's ONE action on its title line. The sin goes to the
 *   program page in memory (`setPendingProgram`), never in the route (roadmap §0.2).
 * «لحظة مجاهدة» is not on the sin page (C-15: one title-line action, as on the website): it opens from the program, the
 * header button and «عاداتي».
 */

import React, { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, LockKeyholeOpen } from 'lucide-react-native';
import { isActiveProgram } from '@thekra/practice-core';
import { isSignedIn, openSignIn } from '@/lib/auth/require-sign-in';
import { setPendingProgram, usePracticeStore } from '@/lib/practice/practice-store';
import { isVaultUnlocked, useVaultState } from '@/lib/practice/vault-runner';
import { BottomSheet, Button, ButtonPair, Text } from '@/ui';

/**
 * The title line of a sin page (owner round 6, C-15 / C-12): «تخفّف من هذه المعصية» (solid) when no program for it runs,
 * else the program's lock state (outlined; no «أنت مشترك» line): «مقفل ✓» while «تخفّف» is locked (the key is not in
 * memory) — a tap opens a small popup whose «افتح القفل» opens the program, where the fingerprint / face or the privacy
 * code unlocks it (SinProgramGuard) — and «في خطتك» while it is open (a tap opens the program). The sin goes to the program page in memory (`setPendingProgram`), never in the route (roadmap §0.2). Practice is for
 * members: a guest signs in first.
 */
export function SinProgramStart({ sin }: { sin: string }) {
  const { t } = useTranslation();
  const isActive = usePracticeStore((s) => s.store.programs.some((p) => p.sinSlug === sin && isActiveProgram(p)));
  const status = useVaultState((s) => s.status);
  const unlocked = isVaultUnlocked() || status === 'unlocked';
  const [asking, setAsking] = useState(false);

  function handleOpen() {
    setAsking(false);
    setPendingProgram(sin);
    if (isSignedIn()) router.push('/practice/sin-program');
    else openSignIn('/practice/sin-program');
  }

  if (!isActive) return <Button label={t('topic.lightenThisSin')} size="sm" onPress={handleOpen} />;
  if (unlocked) return <Button label={t('topic.sinInPlan')} icon={Check} variant="outline" size="sm" onPress={handleOpen} />;
  return (
    <>
      <Button
        label={t('topic.locked')}
        icon={Check}
        variant="outline"
        size="sm"
        onPress={() => setAsking(true)}
        accessibilityLabel={t('topic.lockedLabel')}
      />
      <BottomSheet
        visible={asking}
        title={t('sinLock.lockedTitle')}
        onClose={() => setAsking(false)}
        footer={
          <ButtonPair
            size="lg"
            primary={{ label: t('topic.unlock'), icon: LockKeyholeOpen, onPress: handleOpen }}
            secondary={{ label: t('common.cancel'), onPress: () => setAsking(false) }}
          />
        }
      >
        <Text variant="body">{t('sinLock.lockedHint')}</Text>
      </BottomSheet>
    </>
  );
}
