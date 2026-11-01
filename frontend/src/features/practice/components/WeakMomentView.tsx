'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  formatCountdown,
  momentProgram,
  programEntryFor,
  recordWavePassed,
  URGE_ACTIONS,
  urgeProgress,
  urgeTextIds,
  urgeTextIndex,
  type UrgeAction,
} from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import { QuoteCard } from '@/components/shared/quote';
import { formatDigits } from '@/lib/format/digits';
import { momentSourceForView, updateStore } from '@/lib/practice/local-store';
import { allProgramEvidenceIds } from '@/lib/practice/programs';
import type { QuoteDto } from '@/lib/types/api';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeEvidence } from '../hooks/usePracticeEvidence';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useToday } from '../hooks/useToday';
import { FixItSheet } from './FixItSheet';
import { PracticeLoading } from './PracticeLoading';
import { ProgressRing } from './ProgressRing';

const noSubscribe = () => () => {};
const serverSource = () => undefined;
const TICK_MS = 1000;

type Outcome = { kind: 'held'; result: 'saved' | 'kept' | 'none' } | { kind: 'slipped' } | null;

interface WeakMomentViewProps {
  /** Al-A'raf 7:201 as stored (content rule §3.1); the screen works without it. */
  verse: QuoteDto | null;
}

/**
 * «لحظة ضعف». LOCAL ONLY: which program it is about comes from the device (practice-core `focusProgram`, or a sin
 * page's in-memory hand-off); the requests are the same for every visitor (the stored verse, the catalog, the whole
 * evidence set). A ten-minute ring, one rotating text, one-tap ticks (not stored), then «عبرت الموجة؟»: yes marks
 * «ثبتّ» for today when the day has no check-in; no opens «خربانة؟ صلّحها». Without a program nothing is stored and
 * nothing personal is shown.
 */
export function WeakMomentView({ verse }: WeakMomentViewProps) {
  const t = useTranslations('leaveSin.moment');
  const english = useLocale() === 'en';
  const snapshot = usePracticeStore();
  const clock = useToday();
  const catalog = usePracticeCatalog();
  const source = useSyncExternalStore(noSubscribe, momentSourceForView, serverSource);
  const evidenceIds = useMemo(() => (catalog.data ? allProgramEvidenceIds(catalog.data.sinPrograms) : []), [catalog.data]);
  const evidence = usePracticeEvidence(evidenceIds, Boolean(catalog.data));
  const habits = useMemo(() => new Map<string, PracticeHabit>((catalog.data?.habits ?? []).map((h) => [h.key, h])), [catalog.data]);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [ticks, setTicks] = useState<ReadonlySet<UrgeAction>>(() => new Set());
  const [early, setEarly] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [fixOpen, setFixOpen] = useState(false);

  useEffect(() => {
    const first = window.setTimeout(() => {
      const at = Date.now();
      setStartedAt(at);
      setNow(at);
    }, 0);
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  if (!snapshot || !clock || startedAt === null) return <PracticeLoading />;

  const today = clock.today;
  const progress = urgeProgress(startedAt, now);
  const program = momentProgram(snapshot.store.programs, source, today);
  const sinPrograms = catalog.data?.sinPrograms;
  const entry = program && sinPrograms ? programEntryFor(sinPrograms.programs, program.sinSlug, program.category) : null;
  const common = sinPrograms?.common ?? null;
  const commonIds = common ? [...(common.afterFall.evidence ?? []), ...(common.stages.harms.evidence ?? [])] : [];
  const fetched = new Map((evidence.data ?? []).map((q) => [q.id, q]));
  const texts = urgeTextIds(entry?.evidence, commonIds).flatMap((id) => fetched.get(id) ?? []);
  const textIndex = urgeTextIndex(texts.length, today, (now - startedAt) / 1000);
  const text = textIndex >= 0 ? texts[textIndex] : undefined;
  const asking = progress.done || early;

  function toggle(action: UrgeAction) {
    setTicks((current) => {
      const next = new Set(current);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  }

  function answerYes() {
    if (!program) {
      setOutcome({ kind: 'held', result: 'none' });
      return;
    }
    const hadDay = program.checkIns.some((c) => c.date === today);
    updateStore((store) => ({
      ...store,
      programs: store.programs.map((p) => (p.sinSlug === program.sinSlug ? recordWavePassed(p, today) : p)),
    }));
    setOutcome({ kind: 'held', result: hadDay ? 'kept' : 'saved' });
  }

  function answerNo() {
    setOutcome({ kind: 'slipped' });
    if (program && entry && common) setFixOpen(true);
  }

  const surah = verse?.quran ? (english ? verse.quran.surahName : verse.quran.surahNameAr) : null;
  const verseEnglish = english ? (verse?.translation?.text?.trim() ?? null) : null;

  return (
    <div className="flex flex-col items-center gap-10 text-center">
      {verse ? (
        <figure className="flex max-w-3xl flex-col items-center gap-2">
          <blockquote lang="ar" dir="rtl" className="font-quran text-2xl leading-[2.1] text-foreground sm:text-3xl">
            ﴿{verse.textAr}﴾
          </blockquote>
          {verseEnglish ? <p className="text-base leading-8 text-muted-foreground">{verseEnglish}</p> : null}
          {surah && verse.quran?.ayahNumber != null ? (
            <figcaption className="text-sm text-muted-foreground">
              {t('verseCitation', {
                surah,
                chapter: formatDigits(verse.quran.surahNumber ?? 7),
                ayah: formatDigits(verse.quran.ayahNumber),
              })}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <ProgressRing fraction={progress.fraction} label={t('remaining', { time: formatCountdown(progress.remaining) })}>
        <span className="text-3xl font-medium tabular-nums" aria-hidden>
          {formatCountdown(progress.remaining)}
        </span>
        <span className="max-w-32 text-xs leading-5 text-muted-foreground" aria-hidden>
          {t('timer')}
        </span>
      </ProgressRing>

      {text ? (
        <section aria-label={t('textLabel')} className="w-full max-w-2xl text-start">
          <QuoteCard quote={text} density="compact" intent="good-deed" />
        </section>
      ) : null}

      <section aria-labelledby="moment-actions" className="flex w-full max-w-2xl flex-col gap-3">
        <h2 id="moment-actions" className="text-xl font-medium">
          {t('actionsTitle')}
        </h2>
        <ul className="flex flex-wrap justify-center gap-2">
          {URGE_ACTIONS.map((action) => {
            const on = ticks.has(action);
            return (
              <li key={action}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(action)}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
                    on ? 'border-primary text-primary' : 'border-border hover:bg-muted',
                  )}
                >
                  {on ? <Check className="size-4" aria-hidden /> : null}
                  {t(`actions.${action}`)}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-live="polite" className="flex w-full max-w-2xl flex-col items-center gap-4">
        {outcome?.kind === 'held' ? (
          <p className="flex items-center gap-2 text-lg text-primary" role="status">
            <Check className="size-5" aria-hidden />
            {outcome.result === 'saved' ? t('heldSaved') : outcome.result === 'kept' ? t('heldKept') : t('heldNoProgram')}
          </p>
        ) : outcome?.kind === 'slipped' && !(program && entry && common) && common ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-medium text-primary">{english ? common.afterFall.titleEn : common.afterFall.titleAr}</h2>
            <p className="text-lg leading-9">{english ? common.afterFall.bodyEn : common.afterFall.bodyAr}</p>
          </div>
        ) : asking ? (
          <>
            <h2 className="text-2xl font-medium">{t('question')}</h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Button tone="primary" size="lg" onClick={answerYes}>
                {t('yes')}
              </Button>
              <Button variant="outline" tone="neutral" size="lg" onClick={answerNo}>
                {t('no')}
              </Button>
            </div>
          </>
        ) : (
          <button type="button" className="text-link text-sm" onClick={() => setEarly(true)}>
            {t('answerEarly')}
          </button>
        )}
        {outcome?.kind === 'slipped' && program && entry && common ? (
          <Button variant="outline" tone="primary" onClick={() => setFixOpen(true)}>
            {english ? common.afterFall.titleEn : common.afterFall.titleAr}
          </Button>
        ) : null}
        {program ? (
          <Link href="/practice/leave-sin" className="text-link">
            {t('back')} <DirectionalArrow />
          </Link>
        ) : null}
      </section>

      {program && entry && common ? (
        <FixItSheet
          open={fixOpen}
          onOpenChange={setFixOpen}
          program={program}
          entry={entry}
          common={common}
          habits={habits}
          quotes={evidence.data ?? []}
          today={today}
        />
      ) : null}
    </div>
  );
}
