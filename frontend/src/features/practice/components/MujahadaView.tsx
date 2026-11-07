'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { BookOpen, Check, HandHeart, ListChecks, Sprout, Waves } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  activePrograms,
  formatCountdown,
  momentProgram,
  programEntryFor,
  recordWavePassed,
  strategyByKey,
  urgeProgress,
} from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Button } from '@/components/shared/kit/button';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { QuoteCard } from '@/components/shared/quote';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDigits } from '@/lib/format/digits';
import { momentSourceForView, updateStore } from '@/lib/practice/local-store';
import { allMomentEvidenceIds, momentToolsFor } from '@/lib/practice/moment-tools';
import { mujahadaIds, mujahadaIndex, mujahadaItems } from '@/lib/practice/mujahada';
import { allProgramEvidenceIds } from '@/lib/practice/programs';
import type { QuoteDto } from '@/lib/types/api';
import type { MomentTool, PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeEvidence } from '../hooks/usePracticeEvidence';
import { useSinNames } from '../hooks/useSinNames';
import { useWirdContext } from '../hooks/useWirdContext';
import { EasyDeedsDialog } from './EasyDeedsDialog';
import { FixItSheet } from './FixItSheet';
import { PracticeLoading } from './PracticeLoading';
import { ProgressRing } from './ProgressRing';
import { ShortWirdDialog, TasbihDialog } from './MujahadaTools';

const noSubscribe = () => () => {};
const serverSource = () => undefined;
const TICK_MS = 1000;

type Outcome = { kind: 'held'; result: 'saved' | 'kept' | 'none' } | { kind: 'slipped' } | null;
type Tool = 'tasbih' | 'wird' | 'deeds';

interface MujahadaViewProps {
  /** Al-A'raf 7:201 as stored: shown only while the catalog has no «لحظة مجاهدة» verses. */
  verse: QuoteDto | null;
}

/**
 * «لحظة مجاهدة» (owner round 3, item 15; round 5, F-09 / F-12), the same screen as the app (mobile/app/practice/moment.tsx).
 * Top to bottom: the ten-minute ring; «افعل واحدة الآن»: the acts tied to the texts for this sin (catalog
 * `sinPrograms.moment`: the member's program, else the sin page it was opened from, else the generic acts), each with a
 * small «الدليل» that opens its texts; «أدوات تعينك» (the tasbih counter, «وردٌ أقصر», «أعمال سهلة») and the «اركب
 * الموجة» line; one verse passage on patience, rotating; then «كيف كانت مجاهدتك؟». Kind words only.
 *
 * Privacy: which sin it is about comes from this device only (an in-memory hand-off, never the URL). Every request is
 * the same for every member: the catalog, the texts of EVERY act and every program at once (fixed batches of 50), and
 * the public sin list for the names. The page may name the member's own program as plain text, never a heading or the
 * tab title; a notification never names it.
 */
export function MujahadaView({ verse }: MujahadaViewProps) {
  const t = useTranslations('leaveSin.moment');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const english = locale === 'en';
  const context = useWirdContext();
  const catalog = usePracticeCatalog();
  const sins = useSinNames(locale);
  const source = useSyncExternalStore(noSubscribe, momentSourceForView, serverSource);
  const mujahada = catalog.data?.mujahada;
  const moment = catalog.data?.sinPrograms.moment;
  const ids = useMemo(
    () => [
      ...mujahadaIds(mujahada),
      ...allMomentEvidenceIds(moment),
      ...(catalog.data ? allProgramEvidenceIds(catalog.data.sinPrograms) : []),
    ],
    [mujahada, moment, catalog.data],
  );
  const evidence = usePracticeEvidence(ids, Boolean(catalog.data));
  const quotes = useMemo(() => new Map((evidence.data ?? []).map((q) => [q.id, q])), [evidence.data]);
  const habits = useMemo(() => new Map<string, PracticeHabit>((catalog.data?.habits ?? []).map((h) => [h.key, h])), [catalog.data]);
  const names = useMemo(
    () => new Map((sins.data ?? []).map((sin) => [sin.slug, english ? sin.name || sin.nameAr : sin.nameAr])),
    [sins.data, english],
  );

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [early, setEarly] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [tool, setTool] = useState<Tool | null>(null);
  const [act, setAct] = useState<MomentTool | null>(null);
  /** The program picked in the chooser (several running, opened without a hand-off). */
  const [picked, setPicked] = useState<string | null>(null);

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
  const running = activePrograms(snapshot.store.programs);
  const fallback = momentProgram(snapshot.store.programs, source, today);
  // No hand-off and several programs: the member says which one (the program in focus is the default).
  const asksWhich = (source === undefined || source === null) && running.length > 1;
  const program = (asksWhich && picked ? running.find((p) => p.sinSlug === picked) : null) ?? fallback;
  // A sin page's hand-off without a program still gets that sin's acts (public content of the page it came from).
  const sinForActs = program?.sinSlug ?? (typeof source === 'string' ? source : null);
  const acts = momentToolsFor(moment, sinForActs);
  const sinPrograms = catalog.data?.sinPrograms;
  const entry = program && sinPrograms ? programEntryFor(sinPrograms.programs, program.sinSlug, program.category) : null;
  const common = sinPrograms?.common ?? null;
  const canFix = Boolean(program && entry && common);
  // Only what could be read (an unpublished id is left out by the API): the rotation never shows an empty slot.
  const items = mujahadaItems(mujahada).filter((it) =>
    it.kind === 'passage' ? it.ids.every((id) => quotes.has(id)) : quotes.has(it.id),
  );
  const index = mujahadaIndex(items.length, today, (now - startedAt) / 1000);
  const item = index >= 0 ? items[index] : undefined;
  const asking = progress.done || early;
  const wave = strategyByKey('ride-wave');

  function answerHeld() {
    if (!program) {
      setOutcome({ kind: 'held', result: 'none' });
      return;
    }
    const hadDay = program.checkIns.some((c) => c.date === today);
    updateStore((store) => ({
      ...store,
      programs: store.programs.map((p) => (p.sinSlug === program.sinSlug && p.endedAt === undefined ? recordWavePassed(p, today) : p)),
    }));
    setOutcome({ kind: 'held', result: hadDay ? 'kept' : 'saved' });
  }

  function answerSlipped() {
    setOutcome({ kind: 'slipped' });
    if (canFix) setFixOpen(true);
  }

  const backLink = (
    <Button asChild variant="outline" tone="primary" size="lg">
      <Link href="/practice/leave-sin">
        {t('back')} <DirectionalArrow />
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex justify-center">
        <ProgressRing fraction={progress.fraction} label={t('remaining', { time: formatCountdown(progress.remaining) })}>
          <span className="text-3xl font-medium tabular-nums" aria-hidden>
            {formatCountdown(progress.remaining)}
          </span>
          <span className="max-w-32 text-center text-xs leading-5 text-muted-foreground" aria-hidden>
            {t('timer')}
          </span>
        </ProgressRing>
      </div>

      {asksWhich ? (
        <div className="flex flex-col gap-2">
          <p id="moment-which" className="text-sm font-medium text-muted-foreground">
            {t('which')}
          </p>
          <div role="radiogroup" aria-labelledby="moment-which" className="flex flex-wrap gap-2">
            {running.map((p) => {
              const on = program?.sinSlug === p.sinSlug;
              return (
                <button
                  key={p.sinSlug}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(p.sinSlug)}
                  className={cn(
                    'min-h-11 rounded-lg border px-4 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
                    on ? 'border-primary bg-primary/10 text-primary-text' : 'border-border hover:border-primary',
                  )}
                >
                  {names.get(p.sinSlug) ?? '…'}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {acts.tools.length > 0 ? (
        <section aria-labelledby="moment-acts" className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 id="moment-acts" className="text-xl font-medium">
              {t('actionsTitle')}
            </h2>
            {/* The program's name as plain text under the title, never a heading (and only the member's own program). */}
            {acts.own && program && !asksWhich && names.get(program.sinSlug) ? (
              <p className="text-sm text-muted-foreground">{names.get(program.sinSlug)}</p>
            ) : null}
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {acts.tools.map((tool) => {
              const title = english ? tool.titleEn : tool.titleAr;
              return (
                <li key={tool.key} className="flex min-h-14 items-center gap-3 py-2">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0 flex-1 text-lg leading-8 font-medium">{title}</span>
                  <Button
                    variant="outline"
                    tone="neutral"
                    size="sm"
                    className="shrink-0"
                    icon={<BookOpen aria-hidden />}
                    aria-haspopup="dialog"
                    aria-label={t('evidenceFor', { act: title })}
                    onClick={() => setAct(tool)}
                  >
                    {t('evidence')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="moment-tools" className="flex flex-col gap-3">
        <h2 id="moment-tools" className="text-xl font-medium">
          {t('toolsTitle')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ToolButton icon={<HandHeart />} title={t('tools.tasbih')} hint={t('tools.tasbihHint')} onClick={() => setTool('tasbih')} />
          <ToolButton icon={<ListChecks />} title={t('tools.wird')} hint={t('tools.wirdHint')} onClick={() => setTool('wird')} />
          <ToolButton icon={<Sprout />} title={t('tools.deeds')} hint={t('tools.deedsHint')} onClick={() => setTool('deeds')} />
        </div>
        {/* «اركب الموجة» in its moment (F-12 a): the strategy's idea, one line. */}
        {wave ? <WaveLine title={english ? wave.titleEn : wave.titleAr} /> : null}
      </section>

      {item || (items.length === 0 && verse && !evidence.isLoading) ? (
        <>
          <SectionDivider />
          <section aria-label={t('textLabel')} aria-live="off" className="text-center">
            {item?.kind === 'passage' ? (
              <Passage quotes={item.ids.flatMap((id) => quotes.get(id) ?? [])} />
            ) : item?.kind === 'saying' && quotes.get(item.id) ? (
              <div className="text-start">
                <QuoteCard quote={quotes.get(item.id) as QuoteDto} density="compact" intent="good-deed" />
              </div>
            ) : verse ? (
              <Passage quotes={[verse]} />
            ) : null}
          </section>
        </>
      ) : null}

      <SectionDivider />

      <section aria-live="polite" aria-labelledby="moment-question" className="flex flex-col gap-4">
        {outcome?.kind === 'held' ? (
          <div className="next-step !mt-0 flex flex-col gap-1" role="status">
            <p id="moment-question" className="flex items-center gap-2 text-lg font-medium text-primary-text">
              <Check className="size-5" aria-hidden />
              {t('heldTitle')}
            </p>
            <p className="text-muted-foreground">
              {outcome.result === 'saved' ? t('heldSaved') : outcome.result === 'kept' ? t('heldKept') : t('heldNoProgram')}
            </p>
          </div>
        ) : outcome?.kind === 'slipped' ? (
          <div className="flex flex-col gap-2">
            <h2 id="moment-question" className="text-xl font-medium text-primary-text">
              {t('slipTitle')}
            </h2>
            <p className="text-lg leading-9">{t('slipBody')}</p>
            {canFix ? (
              <Button tone="primary" size="lg" className="self-start" onClick={() => setFixOpen(true)}>
                {t('fix')}
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <h2 id="moment-question" className="text-2xl font-medium">
              {t('question')}
            </h2>
            {asking ? (
              <ActionPair>
                <Button tone="primary" size="lg" onClick={answerHeld}>
                  {t('yes')}
                </Button>
                <Button variant="outline" tone="neutral" size="lg" onClick={answerSlipped}>
                  {t('no')}
                </Button>
              </ActionPair>
            ) : (
              // Before the ten minutes end: the answers one tap away (never a lone, unexplained button), and «ارجع إلى
              // تخفَّف» beside it at the same size (A-06).
              <ActionPair>
                <Button tone="primary" size="lg" onClick={() => setEarly(true)}>
                  {t('answerEarly')}
                </Button>
                {program ? backLink : null}
              </ActionPair>
            )}
          </>
        )}
        {program && (asking || outcome) ? <div className="flex">{backLink}</div> : null}
      </section>

      <ActEvidenceDialog
        act={act}
        onClose={() => setAct(null)}
        quotes={quotes}
        loading={evidence.isPending}
        error={evidence.isError ? evidence.error : null}
        onRetry={() => void evidence.refetch()}
      />
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
      <EasyDeedsDialog
        open={tool === 'deeds'}
        onOpenChange={(open) => setTool(open ? 'deeds' : null)}
        slugs={mujahada?.easyHighReward ?? []}
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

/** «اركب الموجة»: the strategy where it is used (F-12 a), its idea in one line. */
function WaveLine({ title }: { title: string }) {
  const t = useTranslations('practice.strategies.items');
  return (
    <div className="next-step !mt-0 flex items-start gap-3">
      <Waves className="mt-1.5 size-4 shrink-0 text-primary-text" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <strong>{title}</strong>
        <span className="leading-8">{t('ride-wave.idea')}</span>
      </div>
    </div>
  );
}

interface ActEvidenceDialogProps {
  act: MomentTool | null;
  onClose: () => void;
  /** Every act's texts, fetched at once for all members (never this act's ids alone). */
  quotes: ReadonlyMap<string, QuoteDto>;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

/** An act's texts, read by id from the database (never typed here). */
function ActEvidenceDialog({ act, onClose, quotes, loading, error, onRetry }: ActEvidenceDialogProps) {
  const t = useTranslations('leaveSin.moment');
  const english = useLocale() === 'en';
  const shown = act ? act.evidence.flatMap((id) => quotes.get(id) ?? []) : [];
  return (
    <Dialog open={act !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 sm:max-w-xl">
        <DialogHeader className="pe-8">
          <DialogTitle className="leading-8">{t('evidence')}</DialogTitle>
          <DialogDescription className="leading-7">{act ? (english ? act.titleEn : act.titleAr) : ''}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <BrandLoader label={t('evidence')} showLabel />
          ) : error ? (
            <QueryErrorState error={error} onRetry={onRetry} className="py-6" />
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('evidenceMissing')}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {shown.map((quote) => (
                <li key={quote.id}>
                  <QuoteCard quote={quote} density="compact" intent="good-deed" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolButton({ icon, title, hint, onClick }: { icon: React.ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-start transition-colors duration-150 hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
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
