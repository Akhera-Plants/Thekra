'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { recordDeedAfterFall, type SinProgram } from '@thekra/practice-core';
import { formatDigits } from '@/lib/format/digits';
import { updateStore } from '@/lib/practice/local-store';
import { updateProgram } from '@/lib/practice/programs';
import type { QuoteDto } from '@/lib/types/api';
import type { FollowWithGood as FollowWithGoodContent, SinStageContent } from '@/lib/types/practice';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { EvidenceQuotes } from './EvidenceQuotes';

const FALL_STEPS = ['istighfar', 'deeds', 'close'] as const;
type FallStep = (typeof FALL_STEPS)[number];

interface FollowWithGoodProps {
  program: SinProgram;
  today: string;
  flow: FollowWithGoodContent;
  /** «خربانة؟ صلّحها»: the heading and opening words of the flow. */
  intro: SinStageContent;
  /** Every program's evidence, fetched once for all. */
  quotes: readonly QuoteDto[];
  /** In the «لحظة الضعف» dialog: «عودة» at the close. */
  onDone?: () => void;
}

/** The texts of `ids` that were published (a step without one shows none). */
function StepTexts({ ids, quotes }: { ids: readonly string[] | undefined; quotes: readonly QuoteDto[] }) {
  const shown = (ids ?? []).filter((id) => quotes.some((quote) => quote.id === id)).slice(0, 1);
  return shown.length > 0 ? <EvidenceQuotes ids={shown} quotes={quotes} /> : null;
}

/**
 * «أتبِع السيئة الحسنة» after «وقعت ثم تبت»: the istighfar line, then «حسنة صغيرة الآن» («فعلتها» keeps the deed's key
 * with the day's check-in, in this browser only), then a hopeful close. Every line is catalog content; the texts come
 * from the API. No reset and no blame: the stages do not change.
 */
export function FollowWithGood({ program, today, flow, intro, quotes, onDone }: FollowWithGoodProps) {
  const t = useTranslations('leaveSin.fall');
  const english = useLocale() === 'en';
  const deedKey = program.checkIns.find((c) => c.date === today)?.deed;
  const [step, setStep] = useState<FallStep>(deedKey ? 'close' : 'istighfar');
  const [selected, setSelected] = useState<string | null>(null);
  const stepRef = useFocusOnChange<HTMLDivElement>(step);
  const chosen = flow.deeds.choices.find((c) => c.key === (deedKey ?? selected));
  const text = (content: { titleAr: string; titleEn: string }) => (english ? content.titleEn : content.titleAr);
  const body = (content: { bodyAr?: string; bodyEn?: string }) => (english ? content.bodyEn : content.bodyAr);

  function handleDid() {
    if (!selected) return;
    updateStore((store) => ({
      ...store,
      programs: updateProgram(store.programs, program.sinSlug, (p) => recordDeedAfterFall(p, today, selected)),
    }));
    setStep('close');
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby={`fall-${program.sinSlug}`}>
      <h3 id={`fall-${program.sinSlug}`} className="text-xl font-medium text-primary">
        {text(intro)}
      </h3>
      <p className="max-w-3xl text-lg leading-9">{body(intro)}</p>
      <p className="eyebrow">
        {t('progress', { n: formatDigits(FALL_STEPS.indexOf(step) + 1), total: formatDigits(FALL_STEPS.length) })}
      </p>

      <div ref={stepRef} tabIndex={-1} className="flex flex-col gap-4 focus:outline-none">
        {step === 'istighfar' ? (
          <>
            <h4 className="text-lg font-medium">{text(flow.istighfar)}</h4>
            <p className="text-2xl leading-relaxed font-medium" lang={english ? 'en' : 'ar'}>
              {english ? flow.istighfar.lineEn : flow.istighfar.lineAr}
            </p>
            <p className="max-w-3xl leading-8">{body(flow.istighfar)}</p>
            <StepTexts ids={flow.istighfar.evidence} quotes={quotes} />
            <button type="button" className="solid-button button-wrap self-start" onClick={() => setStep('deeds')}>
              {t('next')}
            </button>
          </>
        ) : null}

        {step === 'deeds' ? (
          <>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-lg font-medium">{text(flow.deeds)}</legend>
              <p className="max-w-3xl leading-8">{body(flow.deeds)}</p>
              {flow.deeds.choices.map((choice) => (
                <label
                  key={choice.key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 has-[:checked]:border-primary has-[:focus-visible]:border-primary"
                >
                  <input
                    type="radio"
                    className="mt-1.5 size-4 shrink-0 accent-primary"
                    name={`fall-deed-${program.sinSlug}`}
                    value={choice.key}
                    checked={selected === choice.key}
                    onChange={() => setSelected(choice.key)}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{text(choice)}</span>
                    {body(choice) ? <span className="text-sm leading-7 text-muted-foreground">{body(choice)}</span> : null}
                  </span>
                </label>
              ))}
            </fieldset>
            <StepTexts ids={chosen?.evidence ?? flow.deeds.evidence} quotes={quotes} />
            <div className="flex flex-wrap gap-3">
              <button type="button" className="solid-button button-wrap" onClick={handleDid} disabled={!selected}>
                <Check className="size-4" aria-hidden />
                {t('did')}
              </button>
              <button type="button" className="outline-button button-wrap" onClick={() => setStep('close')}>
                {t('later')}
              </button>
            </div>
          </>
        ) : null}

        {step === 'close' ? (
          <>
            {chosen && deedKey ? (
              <p className="flex items-center gap-2 text-primary" role="status">
                <Check className="size-4" aria-hidden />
                {t('deedDone', { deed: text(chosen) })}
              </p>
            ) : null}
            <h4 className="text-lg font-medium">{text(flow.close)}</h4>
            <p className="max-w-3xl text-lg leading-9">{body(flow.close)}</p>
            <StepTexts ids={flow.close.evidence} quotes={quotes} />
            {onDone ? (
              <button type="button" className="outline-button button-wrap self-start" onClick={onDone}>
                {t('back')}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
