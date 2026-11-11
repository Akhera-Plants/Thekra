'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface FeaturedTextProps {
  /** The card heading («تذكرة مختارة»), shown in the top line. */
  heading: ReactNode;
  /** Other top-line actions (the save button), placed after the whole-text toggle. */
  actions?: ReactNode;
  /** The text, already in the page language (English translation or Arabic original). */
  children: ReactNode;
  lang: 'ar' | 'en';
  /** Classes for the text itself (`featured-verse`, `quran`, the length scale). */
  className?: string;
}

/**
 * The featured card's top line and text. Beside the deed card (desktop) the text takes the
 * height the grid gives it and shows as many whole lines as fit, so this card is never taller
 * than its sibling; stacked (phone) it keeps a per-scale line clamp (site-public.css).
 *
 * When the text is cut, the whole text opens in a layer over the card body without moving
 * anything: on hover, on keyboard focus of the toggle in the top line, or by a tap on the
 * text. Escape or a tap outside closes it. «Read the full text» still opens the reading page.
 */
export function FeaturedText({ heading, actions, children, lang, className }: FeaturedTextProps) {
  const t = useTranslations('home');
  const fullId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pointerType = useRef<string>('mouse');
  const [clamped, setClamped] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [preview, setPreview] = useState(false);
  const open = clamped && (pinned || preview);

  // Fit whole lines into the body, then note whether anything was cut.
  useEffect(() => {
    const body = bodyRef.current;
    const text = textRef.current;
    if (!body || !text) return;
    const measure = () => {
      const fills = getComputedStyle(body).flexGrow !== '0';
      const lineHeight = Number.parseFloat(getComputedStyle(text).lineHeight);
      if (fills && lineHeight > 0) {
        const lines = Math.max(2, Math.floor((body.clientHeight + 1) / lineHeight));
        text.style.setProperty('--fit-lines', String(lines));
      } else {
        text.style.removeProperty('--fit-lines');
      }
      setClamped(text.scrollHeight > text.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(text);
    return () => observer.disconnect();
    // Re-fit when the text's language or scale changes (a client-side language switch keeps
    // this component mounted while the body keeps its size).
  }, [lang, className]);

  // Escape closes; so does a tap or click outside the text and its toggle.
  useEffect(() => {
    if (!open) return;
    const inside = (node: Node | null) =>
      Boolean(node && (bodyRef.current?.contains(node) || toggleRef.current?.contains(node)));
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const hadFocus = inside(document.activeElement);
      setPinned(false);
      setPreview(false);
      if (hadFocus) toggleRef.current?.focus({ preventScroll: true });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target as Node)) {
        setPinned(false);
        setPreview(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setPinned(false);
      setPreview(false);
    } else {
      setPinned(true);
    }
  }

  function endPreviewUnlessInside(next: EventTarget | null) {
    const node = next as Node | null;
    if (node && (bodyRef.current?.contains(node) || toggleRef.current?.contains(node))) return;
    setPreview(false);
  }

  return (
    <>
      <div className="section-topline">
        {heading}
        {clamped ? (
          <button
            ref={toggleRef}
            type="button"
            className="featured-more"
            aria-expanded={open}
            aria-controls={fullId}
            onClick={toggle}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) setPreview(true);
            }}
            onBlur={(event) => endPreviewUnlessInside(event.relatedTarget)}
          >
            {open ? t('hideWholeText') : t('showWholeText')}
          </button>
        ) : null}
        {actions}
      </div>
      <div
        ref={bodyRef}
        className="featured-body"
        data-open={open || undefined}
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setPreview(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setPreview(false);
        }}
        onClick={() => {
          // A tap on the text toggles the layer; a mouse already shows it on hover.
          if (clamped && pointerType.current !== 'mouse') toggle();
        }}
      >
        <p ref={textRef} className={className} lang={lang}>
          {children}
        </p>
        {clamped ? (
          <div
            id={fullId}
            role="region"
            aria-label={t('wholeTextLabel')}
            tabIndex={0}
            className="featured-full"
            hidden={!open}
            onBlur={(event) => endPreviewUnlessInside(event.relatedTarget)}
          >
            <p className={cn(className, 'is-whole')} lang={lang}>
              {children}
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
