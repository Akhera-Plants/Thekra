/**
 * «استمع» on a verse card (owner round 5, F-03 a): plays the ayah's recitation (src/lib/audio/recitation.ts), shows
 * pause while it plays, and stops when the screen loses focus or the card goes away. One recitation at a time in the
 * whole app. Verses only; hadith have no audio. A 48×48 target named for screen readers.
 */

import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Pause, Play } from 'lucide-react-native';
import { chosenReciter, reciterOf } from '@thekra/practice-core';
import { RECITATION, ayahAudioUrl, recitationKey, stopRecitation, toggleRecitation, useRecitation } from '@/lib/audio/recitation';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { radius, useTheme } from '@/theme';
import { Icon } from '@/ui';

export function VerseAudioButton({ surah, ayah, previewReciter }: { surah: number; ayah: number; previewReciter?: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const key = recitationKey(surah, ayah, previewReciter);
  const chosen = usePracticeStore((s) => chosenReciter(s.store));
  const state = useRecitation((s) => (s.key === key ? s.state : 'idle'));
  // Leaving the screen (or unmounting the card) stops this verse.
  useFocusEffect(useCallback(() => () => stopRecitation(key), [key]));
  if (!RECITATION.enabled || !ayahAudioUrl(surah, ayah)) return null;
  const who = previewReciter ? reciterOf(previewReciter) : chosen;
  const reciter = i18n.language === 'en' ? who.en : who.ar;
  const active = state === 'playing' || state === 'loading';
  const label = active ? t('audio.pause') : state === 'error' ? t('audio.error') : t('audio.play', { reciter });
  return (
    <Pressable
      onPress={() => toggleRecitation(surah, ayah, previewReciter)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: state === 'loading', selected: active }}
      android_ripple={{ color: colors.accent, borderless: true, radius: 24 }}
      style={({ pressed }) => [
        {
          width: 48,
          height: 48,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { backgroundColor: colors.accent },
      ]}
    >
      <View>
        {state === 'loading' ? (
          <ActivityIndicator size="small" color={colors.link} />
        ) : (
          <Icon icon={state === 'playing' ? Pause : state === 'error' ? CircleAlert : Play} size={20} tone={state === 'error' ? 'destructive' : 'link'} />
        )}
      </View>
    </Pressable>
  );
}
