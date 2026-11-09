/**
 * Quran recitation for verse cards (owner round 5, F-03 a; round 6 §8 «Audio»): one ayah streamed from a per-ayah
 * source, in the reciter the member chose in the settings (practice-core `reciters.ts`: `RECITERS`, `chosenReciter`,
 * `ayahAudioUrl`), never hadith. One recitation plays at a time in the whole app; a new one stops the last. The screen that started it
 * stops it when it loses focus (VerseAudioButton).
 *
 * SOURCE: everything about the source is in `RECITATION` below, so it can be changed or switched off in one place.
 * EveryAyah (everyayah.com) serves one MP3 per ayah at `<base><SSS><AAA>.mp3` (surah and ayah zero-padded to 3).
 * NOT VERIFIED from this build environment (the host was unreachable): the URL scheme was taken from the round-5 plan
 * and the reciter's/site's terms for use in an app still need the owner's check before release. Until then the
 * feature ships behind `RECITATION.enabled`.
 *
 * expo-audio (SDK 57) is loaded lazily on the first play, so screens and tests that never play do not load the
 * native module.
 */

import { create } from 'zustand';
import type { AudioPlayer, AudioStatus } from 'expo-audio';
import { ayahAudioUrl as reciterAyahUrl, chosenReciter, reciterOf, type Reciter } from '@thekra/practice-core';

export const RECITATION = {
  /** Switch the play button off everywhere. */
  enabled: true,
  /** Per-ayah files of the default reciter: `${base}${SSS}${AAA}.mp3` (the others: practice-core `RECITERS`). */
  base: 'https://everyayah.com/data/Alafasy_128kbps/',
} as const;

/** The member's reciter (settings, synced), else the default. */
export function currentReciter(): Reciter {
  // Read lazily: the store module loads AsyncStorage, which tests of the pure helpers here do not need.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { usePracticeStore } = require('@/lib/practice/practice-store') as typeof import('@/lib/practice/practice-store');
  return chosenReciter(usePracticeStore.getState().store);
}

/** The player key of one ayah in one reciter (a preview in the settings is another key than the same ayah on a card). */
export function recitationKey(surah: number, ayah: number, reciterKey?: string): string {
  return reciterKey ? `${reciterKey}|${surah}:${ayah}` : `${surah}:${ayah}`;
}

const pad3 = (n: number) => String(Math.trunc(n)).padStart(3, '0');

/** The file of one ayah, or null for an impossible reference (1–114, ayah ≥ 1). */
export function ayahAudioUrl(surah: number, ayah: number, base: string = RECITATION.base): string | null {
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || surah < 1 || surah > 114 || ayah < 1 || ayah > 286) return null;
  return `${base}${pad3(surah)}${pad3(ayah)}.mp3`;
}

export type RecitationState = 'idle' | 'loading' | 'playing' | 'error';

interface RecitationStore {
  /** The ayah key (`S:A`) the player holds, or null. */
  key: string | null;
  state: RecitationState;
}

export const useRecitation = create<RecitationStore>(() => ({ key: null, state: 'idle' }));

let player: AudioPlayer | null = null;
const LOAD_TIMEOUT_MS = 15000;

function ensurePlayer(): AudioPlayer {
  if (player) return player;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module (see the header)
  const audio = require('expo-audio') as typeof import('expo-audio');
  void audio.setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'duckOthers' }).catch(() => undefined);
  player = audio.createAudioPlayer(null, { updateInterval: 250 });
  player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
    const { key } = useRecitation.getState();
    if (!key) return;
    if (status.didJustFinish) {
      useRecitation.setState({ key: null, state: 'idle' });
      return;
    }
    if (status.playing) useRecitation.setState({ state: 'playing' });
    else if (status.isBuffering || !status.isLoaded) useRecitation.setState({ state: 'loading' });
  });
  return player;
}

/**
 * Plays the ayah, or pauses it when it is the one playing. Any other recitation stops first. `previewReciter` plays
 * it in that reciter (the settings' preview); otherwise the member's reciter.
 */
export function toggleRecitation(surah: number, ayah: number, previewReciter?: string): void {
  const key = recitationKey(surah, ayah, previewReciter);
  const url = reciterAyahUrl(surah, ayah, reciterOf(previewReciter ?? currentReciter().key).key);
  if (!url || !RECITATION.enabled) return;
  const current = useRecitation.getState();
  try {
    const p = ensurePlayer();
    if (current.key === key && (current.state === 'playing' || current.state === 'loading')) {
      p.pause();
      useRecitation.setState({ key: null, state: 'idle' });
      return;
    }
    p.pause();
    p.replace({ uri: url });
    p.play();
    useRecitation.setState({ key, state: 'loading' });
    // No sound after a while (offline, the file missing): say so on the button instead of spinning.
    setTimeout(() => {
      const now = useRecitation.getState();
      if (now.key === key && now.state === 'loading') {
        player?.pause();
        useRecitation.setState({ state: 'error' });
      }
    }, LOAD_TIMEOUT_MS);
  } catch {
    useRecitation.setState({ key, state: 'error' });
  }
}

/** Stops the recitation (all of it, or only `key` when given): leaving the screen, unmounting a card. */
export function stopRecitation(key?: string): void {
  const current = useRecitation.getState();
  if (key && current.key !== key) return;
  try {
    player?.pause();
  } catch {
    // Nothing is playing.
  }
  if (current.key !== null || current.state !== 'idle') useRecitation.setState({ key: null, state: 'idle' });
}
