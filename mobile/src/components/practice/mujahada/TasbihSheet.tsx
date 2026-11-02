/**
 * «سبّح الآن» (owner round 3, item 15): opened from «افعل واحدة الآن» while the ten-minute timer runs. It keeps showing
 * the time left, offers the usual words of dhikr, a big tap target with the count (a light haptic each tap, a firmer one
 * at each round of 33), and the reward arithmetic «كل ذكر حسنة: × 10 … إلى × 700 إن قبله الله» from the hadith
 * (`mujahada.multiplierHadith`, read by id behind «اقرأ الحديث»). Nothing is stored: the count lives on this screen.
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { formatCountdown } from '@thekra/practice-core';
import { isTasbihRound, REWARD_MAX, REWARD_MIN, tasbihReward } from '@/lib/practice/mujahada';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, Chip, Text, Wrap } from '@/ui';
import { ReadText } from './ReadText';
import { BottomSheet } from './Sheet';

export const TASBIH_PHRASES = ['subhan', 'hamd', 'tahlil', 'takbir', 'istighfar'] as const;
type Phrase = (typeof TASBIH_PHRASES)[number];

const TAP = 220;

const makeStyles = (t: Theme) => ({
  center: { alignItems: 'center' as const, gap: space.md },
  tap: {
    width: TAP,
    height: TAP,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: space.xs,
  },
  tapPressed: { backgroundColor: t.colors.accent, transform: [{ scale: 0.97 }] },
  count: { fontSize: 56, lineHeight: 72 },
  reward: { gap: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: t.colors.muted },
});

export interface TasbihSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Seconds left on the moment's timer. */
  remaining: number;
  multiplierHadith: string | null | undefined;
}

export function TasbihSheet({ visible, onClose, remaining, multiplierHadith }: TasbihSheetProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [phrase, setPhrase] = useState<Phrase>('subhan');
  const [count, setCount] = useState(0);
  const reward = tasbihReward(count);
  const phraseText = t(`mujahada.tasbih.phrases.${phrase}`);

  function tap() {
    const next = count + 1;
    setCount(next);
    if (isTasbihRound(next)) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else void Haptics.selectionAsync();
  }

  return (
    <BottomSheet visible={visible} title={t('mujahada.tasbih.title')} onClose={onClose}>
      <Text variant="small" tone="muted" accessibilityLiveRegion="none">
        {remaining > 0 ? t('mujahada.tasbih.remaining', { time: formatCountdown(remaining) }) : t('mujahada.tasbih.timeDone')}
      </Text>
      <Wrap>
        {TASBIH_PHRASES.map((key) => (
          <Chip key={key} label={t(`mujahada.tasbih.phrases.${key}`)} selected={phrase === key} onPress={() => setPhrase(key)} />
        ))}
      </Wrap>
      <View style={styles.center}>
        <Pressable
          onPress={tap}
          accessibilityRole="button"
          accessibilityLabel={t('mujahada.tasbih.tap', { phrase: phraseText, n: count })}
          style={({ pressed }) => [styles.tap, pressed && styles.tapPressed]}
        >
          <Text variant="body" tone="link">
            {phraseText}
          </Text>
          <Text variant="display" style={styles.count}>
            {String(count)}
          </Text>
          <Text variant="caption" tone="muted">
            {t('mujahada.tasbih.tapHint')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.reward} accessibilityLiveRegion="polite">
        <Text variant="body" weight="medium">
          {count === 0
            ? t('mujahada.tasbih.rewardStart', { min: REWARD_MIN, max: REWARD_MAX })
            : t('mujahada.tasbih.reward', { count: reward.count, min: reward.min, max: reward.max })}
        </Text>
        <ReadText id={multiplierHadith} />
      </View>
      {count > 0 ? <Button label={t('mujahada.tasbih.reset')} onPress={() => setCount(0)} variant="ghost" block /> : null}
    </BottomSheet>
  );
}
