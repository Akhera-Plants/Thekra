'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/kit/button';
import { recitationUrl } from '@/lib/quran/recitation';
import { cn } from '@/lib/utils';

type PlayState = 'idle' | 'loading' | 'playing' | 'error';

/**
 * One native `<audio>` element for the whole page, so only one verse plays at a time: starting another verse stops
 * the first. Created on the first press (never during render or SSR), `preload="none"` until then.
 */
const player: { audio: HTMLAudioElement | null; src: string | null; state: PlayState; listeners: Set<() => void> } = {
  audio: null,
  src: null,
  state: 'idle',
  listeners: new Set(),
};

function emit(state: PlayState) {
  player.state = state;
  player.listeners.forEach((listener) => listener());
}

function audioElement(): HTMLAudioElement {
  if (player.audio) return player.audio;
  const audio = document.createElement('audio');
  audio.preload = 'none';
  audio.addEventListener('playing', () => emit('playing'));
  audio.addEventListener('waiting', () => emit('loading'));
  audio.addEventListener('pause', () => {
    if (player.state !== 'error') emit('idle');
  });
  audio.addEventListener('ended', () => emit('idle'));
  audio.addEventListener('error', () => emit('error'));
  player.audio = audio;
  return audio;
}

function subscribe(listener: () => void) {
  player.listeners.add(listener);
  return () => player.listeners.delete(listener);
}

/** This verse's state: another verse playing reads as idle here. */
function useVerseState(src: string | null): PlayState {
  return useSyncExternalStore(
    subscribe,
    () => (src && player.src === src ? player.state : 'idle'),
    () => 'idle',
  );
}

/**
 * Play / pause the recitation of one verse (F-03 a). A toggle button with a changing name («استمع إلى الآية» /
 * «أوقف التلاوة»), 44px like every icon action of the card. A failed load says so in a polite live region.
 */
export function RecitationButton({ surah, ayah, className }: { surah: number; ayah: number; className?: string }) {
  const t = useTranslations('quote.recitation');
  const src = recitationUrl(surah, ayah);
  const state = useVerseState(src);
  // The failure is said once in the live region; a new press clears it (the state leaves 'error').
  const announce = state === 'error' ? t('failed') : '';

  // Leaving the page (unmount of the last card of this verse) stops its sound.
  useEffect(
    () => () => {
      if (src && player.src === src && player.audio && !player.audio.paused) player.audio.pause();
    },
    [src],
  );

  const toggle = useCallback(() => {
    if (!src) return;
    const audio = audioElement();
    if (player.src === src && (player.state === 'playing' || player.state === 'loading')) {
      audio.pause();
      emit('idle');
      return;
    }
    if (player.src !== src) {
      audio.pause();
      audio.src = src;
      player.src = src;
    }
    emit('loading');
    audio.play().catch((error: unknown) => {
      // A pause() during loading rejects play() with AbortError: not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      emit('error');
    });
  }, [src]);

  if (!src) return null;
  const active = state === 'playing' || state === 'loading';
  const Icon = state === 'loading' ? Loader2 : active ? Pause : Play;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        tone="neutral"
        size="sm"
        iconOnly
        icon={<Icon aria-hidden className={cn(state === 'loading' && 'animate-spin motion-reduce:animate-none')} />}
        aria-label={active ? t('pause') : t('play')}
        aria-pressed={active}
        className={cn('size-11 text-muted-foreground hover:text-foreground aria-pressed:text-primary-text', className)}
        onClick={toggle}
      />
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </>
  );
}
