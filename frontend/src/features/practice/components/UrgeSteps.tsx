'use client';

import { useEffect, useState } from 'react';
import { Check, Share2, Timer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { checkIn, recordUrgePassed, type SinProgram } from '@thekra/practice-core';
import { cn } from '@/lib/utils';
import { formatDigits } from '@/lib/format/digits';
import { reportFailure } from '@/lib/errors';
import { updateStore } from '@/lib/practice/local-store';
import { momentTextIds, pickMomentText, updateProgram } from '@/lib/practice/programs';
import type { QuoteDto } from '@/lib/types/api';
import type { SinProgramCommon, SinProgramEntry, UrgeMoment } from '@/lib/types/practice';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { EvidenceQuotes } from './EvidenceQuotes';
import { FollowWithGood } from './FollowWithGood';

const URGE_STEPS = ['breathe', 'text', 'move', 'delay', 'companion'] as const;
const INHALE_MS = 4000;
const EXHALE_MS = 6000;

type Ending = 'passed' | 'fell' | null;

interface UrgeStepsProps {
  program: SinProgram;
  entry: SinProgramEntry;
  urge: UrgeMoment;
  common: SinProgramCommon;
  quotes: readonly QuoteDto[];
  today: string;
  /** «أجّل عشر دقائق»: the page checks back once, in-page only. */
  onDelay: (minutes: number) => void;
  onClose: () => void;
}

/** A quiet row of dots: where you are, never how long is left. */
function ProgressDots({ index, total }: { index: number; total: number }) {
  const t = useTranslations('leaveSin.urge');
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={Math.min(index + 1, total)}
      aria-label={t('progress', { n: formatDigits(Math.min(index + 1, total)), total: formatDigits(total) })}
      className="flex items-center gap-2"
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={`dot-${i}`} className={cn('size-2 rounded-full', i <= index ? 'bg-primary' : 'bg-border')} />
      ))}
    </div>
  );
}

/** Slow breaths, in for 4 seconds and out for 6; the circle stays still under `prefers-reduced-motion`. */
function BreathPacer({ breaths }: { breaths: number }) {
  const t = useTranslations('leaveSin.urge');
  const [breath, setBreath] = useState(1);
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>('in');

  useEffect(() => {
    if (phase === 'done') return;
    const timer = window.setTimeout(
      () => {
        if (phase === 'in') setPhase('out');
        else if (breath < breaths) {
          setBreath((b) => b + 1);
          setPhase('in');
        } else setPhase('done');
      },
      phase === 'in' ? INHALE_MS : EXHALE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase, breath, breaths]);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div
        className={cn(
          'flex size-40 items-center justify-center rounded-full border border-primary bg-primary/10 transition-transform ease-in-out motion-reduce:transform-none motion-reduce:transition-none',
          phase === 'in' ? 'scale-100 duration-[4000ms]' : 'scale-[0.62] duration-[6000ms]',
        )}
      >
        <span className="text-lg font-medium text-primary" aria-live="polite">
          {phase === 'in' ? t('inhale') : phase === 'out' ? t('exhale') : t('breathDone')}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('breathCount', { n: formatDigits(Math.min(breath, breaths)), total: formatDigits(breaths) })}
      </p>
    </div>
  );
}

/** A generic «ادعُ لي بالثبات» through the system share sheet, or copied where there is none. */
function CompanionShare({ text }: { text: string }) {
  const t = useTranslations('leaveSin.urge');
  const [copied, setCopied] = useState(false);
  async function handleShare() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      reportFailure('urge share', error);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="outline-button button-wrap" onClick={() => void handleShare()}>
        <Share2 className="size-4" aria-hidden />
        {t('companionShare')}
      </button>
      {copied ? (
        <span className="text-sm text-muted-foreground" role="status">
          {t('copied')}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The steps of «لحظة الضعف»: breathe, one text, a practical move, «أجّل عشر دقائق», a companion's prayer, each
 * passed with «التالي». Then «تجاوزتها، الحمد لله» (a private mark: «لحظة ضعف عبرتها», never a failure) or «وقعت»
 * (the day's check-in becomes «وقعت ثم تبت» and «أتبِع السيئة الحسنة» follows). In this browser only.
 */
export function UrgeSteps({ program, entry, urge, common, quotes, today, onDelay, onClose }: UrgeStepsProps) {
  const t = useTranslations('leaveSin.urge');
  const english = useLocale() === 'en';
  const [index, setIndex] = useState(0);
  const [ending, setEnding] = useState<Ending>(null);
  const [move, setMove] = useState<string | null>(null);
  const [delayed, setDelayed] = useState(false);
  const stepRef = useFocusOnChange<HTMLDivElement>(`${index}-${ending}`);
  const step = URGE_STEPS[index];
  const content = step ? urge[step] : null;
  const moment = pickMomentText(momentTextIds(urge, entry), quotes, today);
  const pick = (o: { titleAr: string; titleEn: string }) => (english ? o.titleEn : o.titleAr);
  const body = (o: { bodyAr?: string; bodyEn?: string }) => (english ? o.bodyEn : o.bodyAr);

  function handlePassed() {
    updateStore((store) => ({ ...store, programs: updateProgram(store.programs, program.sinSlug, (p) => recordUrgePassed(p, today)) }));
    setEnding('passed');
  }

  function handleFell() {
    updateStore((store) => ({ ...store, programs: updateProgram(store.programs, program.sinSlug, (p) => checkIn(p, today, 'fell_repented')) }));
    setEnding('fell');
  }

  function handleDelay() {
    onDelay(urge.delay.minutes);
    setDelayed(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <ProgressDots index={ending ? URGE_STEPS.length : index} total={URGE_STEPS.length + 1} />
      <div ref={stepRef} tabIndex={-1} className="flex flex-col gap-4 focus:outline-none">
        {step && content && !ending ? (
          <>
            <h3 className="text-xl font-medium">{pick(content)}</h3>
            <p className="text-lg leading-9">{body(content)}</p>
            {step === 'breathe' ? <BreathPacer breaths={urge.breathe.breaths} /> : null}
            {step === 'text' ? (
              moment ? <EvidenceQuotes ids={[moment.id]} quotes={quotes} /> : <p className="text-muted-foreground">{t('noText')}</p>
            ) : null}
            {step === 'move' ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">{pick(urge.move)}</legend>
                {urge.move.moves.map((m) => (
                  <label
                    key={m.key}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 has-[:checked]:border-primary has-[:focus-visible]:border-primary"
                  >
                    <input
                      type="radio"
                      className="mt-1.5 size-4 shrink-0 accent-primary"
                      name="urge-move"
                      value={m.key}
                      checked={move === m.key}
                      onChange={() => setMove(m.key)}
                    />
                    <span className="flex flex-col gap-1">
                      <span className="font-medium">{pick(m)}</span>
                      {body(m) ? <span className="text-sm leading-7 text-muted-foreground">{body(m)}</span> : null}
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            {step === 'delay' ? (
              delayed ? (
                <p className="flex items-center gap-2 text-primary" role="status">
                  <Check className="size-4" aria-hidden />
                  {t('delaySet', { minutes: formatDigits(urge.delay.minutes) })}
                </p>
              ) : (
                <button type="button" className="outline-button button-wrap self-start" onClick={handleDelay}>
                  <Timer className="size-4" aria-hidden />
                  {t('delayButton', { minutes: formatDigits(urge.delay.minutes) })}
                </button>
              )
            ) : null}
            {step === 'companion' ? <CompanionShare text={english ? urge.companion.shareEn : urge.companion.shareAr} /> : null}
            <button type="button" className="solid-button button-wrap self-start" onClick={() => setIndex((i) => i + 1)}>
              {t('next')}
            </button>
          </>
        ) : null}

        {!step && !ending ? (
          <>
            <h3 className="text-xl font-medium">{t('endTitle')}</h3>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="solid-button button-wrap" onClick={handlePassed}>
                <Check className="size-4" aria-hidden />
                {t('passed')}
              </button>
              <button type="button" className="outline-button button-wrap" onClick={handleFell}>
                {t('fell')}
              </button>
            </div>
          </>
        ) : null}

        {ending === 'passed' ? (
          <>
            <h3 className="text-xl font-medium">{pick(urge.passed)}</h3>
            <p className="text-lg leading-9">{body(urge.passed)}</p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Check className="size-4 text-primary" aria-hidden />
              {t('passedSaved')}
            </p>
            <button type="button" className="outline-button button-wrap self-start" onClick={onClose}>
              {t('back')}
            </button>
          </>
        ) : null}

        {ending === 'fell' && common.followWithGood ? (
          <FollowWithGood program={program} today={today} flow={common.followWithGood} intro={common.afterFall} quotes={quotes} onDone={onClose} />
        ) : null}
        {ending === 'fell' && !common.followWithGood ? (
          <>
            <h3 className="text-xl font-medium text-primary">{pick(common.afterFall)}</h3>
            <p className="text-lg leading-9">{body(common.afterFall)}</p>
            <button type="button" className="outline-button button-wrap self-start" onClick={onClose}>
              {t('back')}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
