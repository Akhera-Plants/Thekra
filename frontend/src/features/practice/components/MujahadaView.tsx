'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Check, Footprints, HandHeart, Phone, Droplets, Sparkles, Timer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  formatCountdown,
  momentProgram,
  programEntryFor,
  recordWavePassed,
  urgeProgress,
} from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import { QuoteCard } from '@/components/shared/quote';
import { formatDigits } from '@/lib/format/digits';
import { momentSourceForView, updateStore } from '@/lib/practice/local-store';
import { mujahadaIds, mujahadaIndex, mujahadaItems } from '@/lib/practice/mujahada';
import { allProgramEvidenceIds } from '@/lib/practice/programs';
import type { QuoteDto } from '@/lib/types/api';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeEvidence } from '../hooks/usePracticeEvidence';
import { useWirdContext } from '../hooks/useWirdContext';
import { FixItSheet } from './FixItSheet';
import { PracticeLoading } from './PracticeLoading';
import { ProgressRing } from './ProgressRing';
import { ShortWirdDialog, TasbihDialog } from './MujahadaTools';

const noSubscribe = () => () => {};
const serverSource = () => undefined;
const TICK_MS = 1000;

/** The quick steps that are ticks on the screen only (the other two open a tool). */
const STEPS = [
  { key: 'wudu', icon: Droplets },
  { key: 'move', icon: Footprints },
  { key: 'call', icon: Phone },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

type Outcome = { kind: 'held'; result: 'saved' | 'kept' | 'none' } | { kind: 'slipped' } | null;

interface MujahadaViewProps {
  /** Al-A'raf 7:201 as stored: shown only while the catalog has no «لحظة مجاهدة» verses. */
  verse: QuoteDto | null;
}

/**
 * «لحظة مجاهدة» (owner round 3, item 15; was «لحظة ضعف»). Top to bottom: «افعل واحدة الآن» (the tasbih counter and a
 * shorter wird open a tool; wudu, a change of place and a call are ticks on the screen), the ten-minute ring with a
 * verse on patience that changes every two minutes (catalog `mujahada`, read by id), then «كيف كانت مجاهدتك؟». Kind
 * words only: «ثبتُّ» marks today held; «زلّت قدمي» opens «صلّحها». Nothing personal is sent: which program it is about
 * comes from this device, and every request is the same for every member.
 */
export function MujahadaView({ verse }: MujahadaViewProps) {
  const t = useTranslations('leaveSin.moment');
  const context = useWirdContext();
  const catalog = usePracticeCatalog();
  const source = useSyncExternalStore(noSubscribe, momentSourceForView, serverSource);
  const mujahada = catalog.data?.mujahada;
  const ids = useMemo(
    () => [...mujahadaIds(mujahada), ...(catalog.data ? allProgramEvidenceIds(catalog.data.sinPrograms) : [])],
    [mujahada, catalog.data],
  );
  const evidence = usePracticeEvidence(ids, Boolean(catalog.data));
  const quotes = useMemo(() => new Map((evidence.data ?? []).map((q) => [q.id, q])), [evidence.data]);
  const habits = useMemo(() => new Map<string, PracticeHabit>((catalog.data?.habits ?? []).map((h) => [h.key, h])), [catalog.data]);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [ticks, setTicks] = useState<ReadonlySet<StepKey>>(() => new Set());
  const [early, setEarly] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [tool, setTool] = useState<'tasbih' | 'wird' | null>(null);

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

  if (!context || startedAt === null) return <PracticeLoading />;

  const { today, snapshot } = context;
  const progress = urgeProgress(startedAt, now);
  const program = momentProgram(snapshot.store.programs, source, today);
  const sinPrograms = catalog.data?.sinPrograms;
  const entry = program && sinPrograms ? programEntryFor(sinPrograms.programs, program.sinSlug, program.category) : null;
  const common = sinPrograms?.common ?? null;
  // Only what could be read (an unpublished id is left out by the API): the rotation never shows an empty slot.
  const items = mujahadaItems(mujahada).filter((it) =>
    it.kind === 'passage' ? it.ids.every((id) => quotes.has(id)) : quotes.has(it.id),
  );
  const index = mujahadaIndex(items.length, today, (now - startedAt) / 1000);
  const item = index >= 0 ? items[index] : undefined;
  const asking = progress.done || early;

  function toggle(step: StepKey) {
    setTicks((current) => {
      const next = new Set(current);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  }

  function answerHeld() {
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

  function answerSlipped() {
    setOutcome({ kind: 'slipped' });
    if (program && entry && common) setFixOpen(true);
  }

  return (
    <div className="flex flex-col items-center gap-10 text-center">
      <section aria-labelledby="moment-actions" className="flex w-full max-w-2xl flex-col gap-4">
        <h2 id="moment-actions" className="text-xl font-medium">
          {t('actionsTitle')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToolButton icon={<Sparkles />} title={t('tools.tasbih')} hint={t('tools.tasbihHint')} onClick={() => setTool('tasbih')} />
          <ToolButton icon={<HandHeart />} title={t('tools.wird')} hint={t('tools.wirdHint')} onClick={() => setTool('wird')} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground" id="moment-steps-label">
            {t('stepsLabel')}
          </p>
          <ul className="flex flex-wrap justify-center gap-2" aria-labelledby="moment-steps-label">
            {STEPS.map(({ key, icon: Icon }) => {
              const on = ticks.has(key);
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(key)}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
                      on ? 'border-primary bg-primary/10 text-primary-text' : 'border-border hover:border-primary',
                    )}
                  >
                    {on ? <Check className="size-4" aria-hidden /> : <Icon className="size-4 text-muted-foreground" aria-hidden />}
                    {t(`steps.${key}`)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <ProgressRing fraction={progress.fraction} label={t('remaining', { time: formatCountdown(progress.remaining) })}>
        <span className="text-3xl font-medium tabular-nums" aria-hidden>
          {formatCountdown(progress.remaining)}
        </span>
        <span className="max-w-32 text-xs leading-5 text-muted-foreground" aria-hidden>
          {t('timer')}
        </span>
      </ProgressRing>

      <section aria-label={t('textLabel')} aria-live="off" className="w-full max-w-3xl">
        {item?.kind === 'passage' ? (
          <Passage quotes={item.ids.flatMap((id) => quotes.get(id) ?? [])} />
        ) : item?.kind === 'saying' && quotes.get(item.id) ? (
          <div className="text-start">
            <QuoteCard quote={quotes.get(item.id) as QuoteDto} density="compact" intent="good-deed" />
          </div>
        ) : items.length === 0 && verse && !evidence.isLoading ? (
          <Passage quotes={[verse]} />
        ) : null}
      </section>

      <section aria-live="polite" className="flex w-full max-w-2xl flex-col items-center gap-4">
        {outcome?.kind === 'held' ? (
          <div className="flex flex-col items-center gap-1" role="status">
            <p className="flex items-center gap-2 text-lg font-medium text-primary-text">
              <Check className="size-5" aria-hidden />
              {t('heldTitle')}
            </p>
            <p className="text-muted-foreground">
              {outcome.result === 'saved' ? t('heldSaved') : outcome.result === 'kept' ? t('heldKept') : t('heldNoProgram')}
            </p>
          </div>
        ) : outcome?.kind === 'slipped' && !(program && entry && common) && common ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-medium text-primary-text">{t('slipTitle')}</h2>
            <p className="text-lg leading-9">{t('slipBody')}</p>
          </div>
        ) : asking ? (
          <>
            <h2 className="text-2xl font-medium">{t('question')}</h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Button tone="primary" size="lg" onClick={answerHeld}>
                {t('yes')}
              </Button>
              <Button variant="outline" tone="neutral" size="lg" onClick={answerSlipped}>
                {t('no')}
              </Button>
            </div>
          </>
        ) : (
          <Button variant="outline" tone="neutral" size="sm" onClick={() => setEarly(true)}>
            <Timer aria-hidden />
            {t('answerEarly')}
          </Button>
        )}
        {outcome?.kind === 'slipped' && program && entry && common ? (
          <Button variant="outline" tone="primary" onClick={() => setFixOpen(true)}>
            {t('fix')}
          </Button>
        ) : null}
        {program ? (
          <Link href="/practice/leave-sin" className="outline-button button-wrap">
            {t('back')} <DirectionalArrow />
          </Link>
        ) : null}
      </section>

      <TasbihDialog
        open={tool === 'tasbih'}
        onOpenChange={(open) => setTool(open ? 'tasbih' : null)}
        progress={progress}
        hadith={mujahada?.multiplierHadith ? (quotes.get(mujahada.multiplierHadith) ?? null) : null}
      />
      <ShortWirdDialog
        open={tool === 'wird'}
        onOpenChange={(open) => setTool(open ? 'wird' : null)}
        context={context}
        hadith={mujahada?.sittingPrayerHadith ? (quotes.get(mujahada.sittingPrayerHadith) ?? null) : null}
      />
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

function ToolButton({ icon, title, hint, onClick }: { icon: React.ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="flex min-h-16 items-center gap-3 rounded-xl border border-primary/40 bg-card px-4 py-3 text-start transition-colors duration-150 hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-text [&_svg]:size-5">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-sm leading-6 text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

/** One Quran passage (1–3 verses together) as stored, with its citation; the English translation on /en. */
function Passage({ quotes }: { quotes: QuoteDto[] }) {
  const t = useTranslations('leaveSin.moment');
  const english = useLocale() === 'en';
  const first = quotes[0];
  if (!first) return null;
  const last = quotes[quotes.length - 1] ?? first;
  const surah = first.quran ? (english ? first.quran.surahName : first.quran.surahNameAr) : null;
  const from = first.quran?.ayahNumber;
  const to = last.quran?.ayahNumber;
  const translation = english ? quotes.map((q) => q.translation?.text?.trim()).filter(Boolean).join(' ') : '';
  return (
    <figure className="flex flex-col items-center gap-2">
      <blockquote lang="ar" dir="rtl" className="font-quran text-2xl leading-[2.1] text-foreground sm:text-3xl">
        ﴿{quotes.map((q) => q.textAr).join(' ')}﴾
      </blockquote>
      {translation ? <p className="max-w-2xl text-base leading-8 text-muted-foreground">{translation}</p> : null}
      {surah && from != null ? (
        <figcaption className="text-sm text-muted-foreground">
          <Link href={`/quotes/${first.id}`} className="hover:text-foreground hover:underline">
            {t('verseCitation', {
              surah,
              chapter: formatDigits(first.quran?.surahNumber ?? 0),
              ayah: from === to || to == null ? formatDigits(from) : `${formatDigits(from)}–${formatDigits(to)}`,
            })}
          </Link>
        </figcaption>
      ) : null}
    </figure>
  );
}
