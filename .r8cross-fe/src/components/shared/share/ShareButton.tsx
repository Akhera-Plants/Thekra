'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react';
import { AtSign, Check, Copy, Globe, ImageDown, Link2, MessageCircle, Send, Share2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/shared/kit/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { env } from '@/lib/env';
import { canonicalUrl } from '@/lib/seo';
import { prepareShareImage, type PreparedShareImage } from '@/lib/share/render-image';
import { shareIntents, shareText, type SharePayload } from '@/lib/share/share-text';
import { cn } from '@/lib/utils';

export interface ShareButtonProps {
  payload: SharePayload;
  /** Canonical page of the text, without the locale prefix (e.g. `/quotes/<id>`). */
  path: string;
  /** Download name without extension. */
  fileName: string;
  /** `kit`: quiet icon button of the quote cards. `site`: the home page's `.icon-button`. */
  appearance?: 'kit' | 'site';
  className?: string;
}

const noSubscription = () => () => {};

function subscribeCoarsePointer(onChange: () => void) {
  const query = window.matchMedia('(pointer: coarse)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** `navigator.share` exists (false during SSR and hydration). */
function useCanNativeShare(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false,
  );
}

/** Touch-first device: the button opens the system share sheet directly. */
function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeCoarsePointer,
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );
}

function shareOrigin(): string {
  return env.PUBLIC_SITE_ORIGIN ?? window.location.origin;
}

type ImageState = 'pending' | 'fits' | 'too-long' | 'error';

/**
 * Share action for one public text. Touch devices with the Web Share API get the system sheet;
 * everything else (or a failed sheet) gets a small menu: device share (when available),
 * WhatsApp, Telegram, X, Facebook, copy link, copy text, download image. The image option shows
 * only once the whole text is known to fit the image at a readable size.
 */
export function ShareButton({
  payload,
  path,
  fileName,
  appearance = 'kit',
  className,
}: ShareButtonProps) {
  const t = useTranslations('share');
  const uiLocale = useLocale() === 'en' ? 'en' : 'ar';
  const canNative = useCanNativeShare();
  const coarse = useCoarsePointer();
  const nativeFirst = canNative && coarse;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const [image, setImage] = useState<{ key: string; state: ImageState } | null>(null);
  const prepared = useRef<{ key: string; promise: Promise<PreparedShareImage> } | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const imageKey = useMemo(
    () => [uiLocale, payload.bodyFace, payload.heading, payload.body, ...payload.attribution].join('\n'),
    [uiLocale, payload],
  );

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

  const announce = useCallback((message: string, success = false) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(message);
    setCopied(success);
    statusTimer.current = setTimeout(() => {
      setStatus('');
      setCopied(false);
    }, 2500);
  }, []);

  const urlNow = useCallback(() => canonicalUrl(uiLocale, path, shareOrigin()), [uiLocale, path]);

  const prepareImage = useCallback((): Promise<PreparedShareImage> => {
    if (prepared.current?.key === imageKey) return prepared.current.promise;
    const host = new URL(shareOrigin()).host;
    const promise = prepareShareImage(payload, { uiLocale, siteName: payload.title, host });
    prepared.current = { key: imageKey, promise };
    setImage({ key: imageKey, state: 'pending' });
    promise.then(
      (result) => setImage({ key: imageKey, state: result.layout.fits ? 'fits' : 'too-long' }),
      () => setImage({ key: imageKey, state: 'error' }),
    );
    return promise;
  }, [imageKey, payload, uiLocale]);

  const warmImage = useCallback(() => {
    if (!nativeFirst) void prepareImage().catch(() => undefined);
  }, [nativeFirst, prepareImage]);

  const shareNative = useCallback(async () => {
    try {
      await navigator.share({ title: payload.title, text: shareText(payload), url: urlNow() });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // The sheet failed (no permission, unsupported data): offer the menu instead.
      warmImage();
      setOpen(true);
    }
  }, [payload, urlNow, warmImage]);

  const copy = useCallback(
    async (value: string, done: string) => {
      try {
        if (!navigator.clipboard) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(value);
        announce(done, true);
      } catch {
        announce(t('copyFailed'));
      }
    },
    [announce, t],
  );

  const downloadImage = useCallback(async () => {
    try {
      const ready = await prepareImage();
      const blob = await ready.draw();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `${fileName}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      announce(t('imageSaved'), true);
    } catch {
      announce(t('imageFailed'));
    }
  }, [announce, fileName, prepareImage, t]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (next) warmImage();
      setOpen(next);
    },
    [warmImage],
  );

  // Touch-first: the system sheet replaces the menu. Radix skips its own handler when ours
  // calls preventDefault; the sheet then opens from the click (a valid user activation).
  const nativeTriggerProps = nativeFirst
    ? {
        onPointerDown: (event: { preventDefault: () => void }) => event.preventDefault(),
        onClick: () => void shareNative(),
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void shareNative();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
          }
        },
      }
    : { onPointerEnter: warmImage, onFocus: warmImage };

  const TriggerIcon = copied ? Check : Share2;
  const imageFits = image?.key === imageKey && image.state === 'fits';
  // Links are built only while the menu is open (client only, after a user action).
  const url = open ? urlNow() : '';
  const intents = open ? shareIntents(payload, url) : null;
  const itemClass = 'min-h-10 gap-2.5 px-2.5 text-[15px]';

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild {...nativeTriggerProps}>
          {appearance === 'site' ? (
            <button
              type="button"
              className={cn('icon-button save-button', className)}
              aria-label={t('button')}
            >
              <TriggerIcon className="size-[19px]" aria-hidden />
            </button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              tone="neutral"
              size="sm"
              iconOnly
              icon={<TriggerIcon aria-hidden />}
              aria-label={t('button')}
              className={cn(
                'size-11 text-muted-foreground hover:text-foreground md:size-11',
                className,
              )}
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-52">
          {intents ? (
            <>
              {canNative && !nativeFirst ? (
                <>
                  <DropdownMenuItem className={itemClass} onSelect={() => void shareNative()}>
                    <Share2 aria-hidden />
                    {t('device')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem asChild className={itemClass}>
                <a href={intents.whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden />
                  {t('whatsapp')}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className={itemClass}>
                <a href={intents.telegram} target="_blank" rel="noopener noreferrer">
                  <Send aria-hidden />
                  {t('telegram')}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className={itemClass}>
                <a href={intents.x} target="_blank" rel="noopener noreferrer">
                  <AtSign aria-hidden />
                  {t('x')}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className={itemClass}>
                <a href={intents.facebook} target="_blank" rel="noopener noreferrer">
                  <Globe aria-hidden />
                  {t('facebook')}
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={itemClass}
                onSelect={() => void copy(url, t('linkCopied'))}
              >
                <Link2 aria-hidden />
                {t('copyLink')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={itemClass}
                onSelect={() => void copy(shareText(payload, url), t('textCopied'))}
              >
                <Copy aria-hidden />
                {t('copyText')}
              </DropdownMenuItem>
              {imageFits ? (
                <DropdownMenuItem className={itemClass} onSelect={() => void downloadImage()}>
                  <ImageDown aria-hidden />
                  {t('downloadImage')}
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </>
  );
}
