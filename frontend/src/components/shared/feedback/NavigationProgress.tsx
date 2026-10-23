'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

type State = 'idle' | 'running' | 'done';

/** A navigation that never lands (offline, aborted) must not leave the bar up forever. */
const GIVE_UP_MS = 20_000;
const PENDING_ATTR = 'data-nav-pending';
const LOADING_SELECTOR = '[data-route-loading]';

/** The in-app destination of a plain left click on a link, or null when the browser handles it. */
function internalTarget(event: MouseEvent): { anchor: HTMLAnchorElement; url: URL } | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same path (query/hash only): the pathname will not change, so the bar could not tell when it is done.
  if (url.pathname === window.location.pathname) return null;
  return { anchor, url };
}

/**
 * Slim brand-green bar at the top of the viewport. Starts on any in-app link press
 * or back/forward, finishes when the route changes. App Router has no router events,
 * so the start is the click itself and the end is the pathname changing; the bar only
 * becomes visible after a short delay (see feedback.css), so instant navigations show nothing.
 * Uses logical properties and a width transition, so it grows from the start edge in RTL too.
 */
export function NavigationProgress() {
  const t = useTranslations('feedback');
  const pathname = usePathname();
  const [state, setState] = useState<State>('idle');
  const pendingAnchor = useRef<HTMLAnchorElement | null>(null);
  const giveUp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settled = useRef(pathname);

  const finish = useCallback(() => {
    if (giveUp.current) clearTimeout(giveUp.current);
    giveUp.current = null;
    pendingAnchor.current?.removeAttribute(PENDING_ATTR);
    pendingAnchor.current = null;
    setState((current) => (current === 'running' ? 'done' : current));
  }, []);

  const start = useCallback(
    (anchor: HTMLAnchorElement | null) => {
      pendingAnchor.current?.removeAttribute(PENDING_ATTR);
      pendingAnchor.current = anchor;
      anchor?.setAttribute(PENDING_ATTR, '');
      if (giveUp.current) clearTimeout(giveUp.current);
      giveUp.current = setTimeout(finish, GIVE_UP_MS);
      setState('running');
    },
    [finish],
  );

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = internalTarget(event);
      if (target) start(target.anchor);
    };
    const onPopState = () => start(null);
    // Capture: Next's own Link handler calls preventDefault, which must not hide the click from us.
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      if (giveUp.current) clearTimeout(giveUp.current);
    };
  }, [start]);

  // The route changed. With a `loading.tsx` the URL commits straight away and the skeleton shows
  // while the page streams in, so the bar keeps going until the skeleton (`data-route-loading`) is gone.
  useEffect(() => {
    if (settled.current === pathname) return;
    settled.current = pathname;
    const observer = new MutationObserver(() => check());
    const check = () => {
      if (document.querySelector(LOADING_SELECTOR)) return;
      observer.disconnect();
      finish();
    };
    observer.observe(document.body, { childList: true, subtree: true });
    // Also check once after this commit (no skeleton at all: the page is already there).
    const first = setTimeout(check, 0);
    return () => {
      clearTimeout(first);
      observer.disconnect();
    };
  }, [pathname, finish]);

  // After the fade-out, reset so the next navigation animates from zero.
  useEffect(() => {
    if (state !== 'done') return;
    const timer = setTimeout(() => setState('idle'), 600);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <>
      <div className="nav-progress" data-state={state} aria-hidden />
      <span className="sr-only" role="status">
        {state === 'running' ? t('navigating') : ''}
      </span>
    </>
  );
}
