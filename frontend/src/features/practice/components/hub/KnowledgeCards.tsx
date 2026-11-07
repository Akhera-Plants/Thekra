'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  branchesInPractice,
  branchOfWeek,
  dayCompletion,
  gratitudeAyah,
  storyQuoteId,
  tallies,
  type HabitTally,
  type Plan,
  type PlanDayOptions,
  type Store,
  type StoryMoment,
} from '@thekra/practice-core';
import { Info } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { QuoteDto } from '@/lib/types/api';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { QuoteCard } from '@/components/shared/quote';
import { getBranch } from '@/lib/api/branches';
import { getAyah } from '@/lib/api/quran';
import { formatDigits } from '@/lib/format/digits';
import { dayDoneLine } from '@/lib/practice/commitment';
import { habitOf } from '@/lib/practice/plans';
import { queryKeys } from '@/lib/query-keys';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeCatalog } from '../../hooks/usePracticeCatalog';
import { usePracticeEvidence } from '../../hooks/usePracticeEvidence';
import { usePlanWords } from '../plan-words';

const TEXT_STALE_MS = 60 * 60 * 1000;
/** How long «تقبّل الله منك» stays after a tick. */
export const CHEER_MS = 2500;

// ── «حصيلتي» ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * «حصيلتي» in «سجلّي» (redesign §4.5): each habit's total this month and since the start in its own unit
 * (practice-core `formatPlanAmount` through `usePlanWords`), «أنت تعمل على N شعب» when the habits' deeds map to
 * branches, one rotating line (Quran 16:53 / 49:17, read by ayah), and «والقبول من الله». The «تخفَّف» days stay
 * inside its locked page only.
 */
export function TallySection({ store, today, habits }: { store: Store; today: string; habits: ReadonlyMap<string, PracticeHabit> }) {
  const t = useTranslations('practice.tally');
  const catalog = usePracticeCatalog();
  const rows = useMemo(() => tallies(store, today), [store, today]);
  const branches = useMemo(
    () => branchesInPractice(store.plans, catalog.data?.deedBranches ?? {}),
    [store.plans, catalog.data],
  );
  return (
    <section aria-labelledby="tally-title" className="flex flex-col gap-3">
      <h2 id="tally-title" className="text-xl font-medium">
        {t('title')}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm leading-7 text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <p className="text-sm leading-7 text-muted-foreground">{t('lead')}</p>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {rows.map((row) => {
              const plan = store.plans.find((p) => p.id === row.planId);
              return plan ? <TallyRow key={row.planId} plan={plan} tally={row} habit={habitOf(plan, habits)} /> : null;
            })}
          </ul>
        </>
      )}
      {branches.length > 0 ? (
        <p className="text-base leading-8">{t('branches', { count: branches.length, n: formatDigits(branches.length) })}</p>
      ) : null}
      <GratitudeLine today={today} />
      <p className="text-base leading-8 text-primary-text">{t('acceptance')}</p>
    </section>
  );
}

function TallyRow({ plan, tally, habit }: { plan: Plan; tally: HabitTally; habit: PracticeHabit | undefined }) {
  const t = useTranslations('practice.tally');
  const words = usePlanWords(plan, habit);
  return (
    <li className="flex flex-col gap-1 py-3">
      <span className="font-medium" lang={words.titleLang}>
        {words.title}
      </span>
      <span className="text-sm leading-7 text-muted-foreground">
        {t('month', { amount: words.amount(tally.month) })} · {t('total', { amount: words.amount(tally.total) })}
      </span>
    </li>
  );
}

/** Quran 16:53 or 49:17 by day (gratitude, sincerity), the stored text only; hidden while it cannot be read. */
function GratitudeLine({ today }: { today: string }) {
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { surah, ayah } = gratitudeAyah(today);
  const verse = useQuery({
    queryKey: queryKeys.surahs.ayah(surah, ayah, locale),
    queryFn: async () => (await getAyah(surah, ayah, { lang: locale })).data,
    staleTime: TEXT_STALE_MS,
  });
  if (!verse.data) return null;
  return (
    <p className="max-w-3xl text-base leading-8 text-muted-foreground">
      <Link href={`/quotes/${verse.data.id}`} lang="ar" dir="rtl" className="font-quran hover:text-foreground">
        {verse.data.textAr}
      </Link>
    </p>
  );
}

// ── Celebration ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * «تقبّل الله منك» for a moment after a tick (`at` changes on each tick). A polite status: screen readers hear it once;
 * the fade is skipped under reduced motion.
 */
export function Cheer({ at }: { at: number | null }) {
  const t = useTranslations('practice.celebrate');
  // The tick whose cheer has run its time; a new tick (`at`) shows it again.
  const [expiredAt, setExpiredAt] = useState<number | null>(null);
  useEffect(() => {
    if (at === null) return;
    const timer = window.setTimeout(() => setExpiredAt(at), CHEER_MS);
    return () => window.clearTimeout(timer);
  }, [at]);
  const shownAt = at !== null && expiredAt !== at ? at : null;
  return (
    <p
      role="status"
      aria-live="polite"
      className="text-base leading-8 text-primary-text motion-safe:transition-opacity motion-safe:duration-300 empty:hidden"
    >
      {shownAt !== null ? t('accepted') : null}
    </p>
  );
}

/**
 * «تمّ وردك اليوم» (owner round 3, item 4): one line once every habit asked today has something logged, and one short
 * achievement line that changes each day. Plain words, no attributed text.
 */
export function DayDoneCard({ store, today, planDays }: { store: Store; today: string; planDays: PlanDayOptions }) {
  const t = useTranslations('practice.celebrate');
  const { complete } = useMemo(() => dayCompletion(store, today, planDays), [store, today, planDays]);
  if (!complete) return null;
  return (
    <div className="next-step !mt-0 flex flex-col gap-1" role="status">
      <p className="text-lg font-medium">{t('dayDone')}</p>
      <p className="text-base leading-8 text-primary-text">{t(`lines.l${dayDoneLine(today)}`)}</p>
    </div>
  );
}

// ── Stories at moments ──────────────────────────────────────────────────────────────────────────────────────

/**
 * A story by Quote id at its moment (heart-texts.yaml `stories:` through the catalog). Shows nothing while the id is
 * not filled, or while the text cannot be read: never typed text.
 */
export function StoryLine({ moment, compact = false, label }: { moment: StoryMoment; compact?: boolean; label?: string }) {
  const t = useTranslations('practice.story');
  const catalog = usePracticeCatalog();
  const id = storyQuoteId(moment, catalog.data?.stories);
  const evidence = usePracticeEvidence(id ? [id] : []);
  const quote = evidence.data?.find((q) => q.id === id);
  if (!quote) return null;
  if (compact) return <StoryNote label={label ?? t(moment)} quote={quote} />;
  return (
    <aside aria-label={t(moment)} className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">{t(moment)}</p>
      <QuoteCard quote={quote} density="compact" intent="good-deed" detailHref={`/quotes/${quote.id}`} />
    </aside>
  );
}

/** The text's source in one short line: the surah and verse, or the book and number. */
function shortSource(quote: QuoteDto, english: boolean): string {
  if (quote.quran?.ayahNumber) {
    const surah = english ? (quote.quran.surahName ?? quote.quran.surahNameAr) : quote.quran.surahNameAr;
    return `${surah ?? ''} ${formatDigits(quote.quran.ayahNumber)}`.trim();
  }
  const book = english ? quote.source.name || quote.source.nameAr : quote.source.nameAr;
  return [book, quote.hadith?.reference ? formatDigits(quote.hadith.reference) : null].filter(Boolean).join(' ');
}

/**
 * A moment in the flow (owner round 4: never a full text card there): one quiet line with an info button; the text, its
 * source and «اقرأ الشرح» open in a popover.
 */
function StoryNote({ label, quote }: { label: string; quote: QuoteDto }) {
  const t = useTranslations('practice.story');
  const english = useLocale() === 'en';
  return (
    <div className="flex items-center gap-2 text-sm leading-7 text-muted-foreground">
      <span>{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" tone="neutral" size="sm" iconOnly icon={<Info aria-hidden />} aria-label={t('more', { title: label })} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] gap-3 p-4">
          <p lang="ar" dir="rtl" className="font-quran text-lg leading-9 text-foreground">
            {quote.textAr}
          </p>
          <p className="text-xs leading-6 text-muted-foreground">{shortSource(quote, english)}</p>
          <Link href={`/quotes/${quote.id}`} className="outline-button self-start text-sm">
            {t('readSharh')} <DirectionalArrow />
          </Link>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── «شعبة الأسبوع» / «اسم الأسبوع» ──────────────────────────────────────────────────────────────────────────

/** «ورد اليوم»'s weekly card (redesign §4.7): «شعبة الأسبوع». («اسم الأسبوع» left with the names pages, F-19 a.)
 * `before` (the divider above it) renders only with the card, so an empty section leaves no lone divider. */
export function WeekCard({ today, before }: { today: string; before?: ReactNode }) {
  return <WeekBranchCard today={today} before={before} />;
}

/** «شعبة الأسبوع» on «ورد اليوم» (only when chosen in Settings): the same branch for everyone this ISO week; a long title wraps. */
export function WeekBranchCard({ today, before }: { today: string; before?: ReactNode }) {
  const t = useTranslations('practice.weekBranch');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const number = branchOfWeek(today);
  const branch = useQuery({
    queryKey: queryKeys.branches.detail(number, locale),
    queryFn: async () => (await getBranch(number, locale)).data,
    staleTime: TEXT_STALE_MS,
  });
  if (!branch.data) return null;
  const title = locale === 'en' ? branch.data.title : branch.data.titleAr;
  if (!title) return null;
  return (
    <>
      {before}
      <section aria-labelledby="week-branch-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="week-branch-title" className="text-xl font-medium">
            {t('title')}
          </h2>
          {/* «الشعبة 9», not a bare «· 9» (W-20). */}
          <p className="text-sm text-muted-foreground">{t('number', { n: formatDigits(number) })}</p>
        </div>
        <Link href={`/branches/${number}`} className="outline-button button-wrap min-w-0 self-start text-base break-words">
          <span className="min-w-0">{title}</span> <DirectionalArrow className="shrink-0" />
        </Link>
      </section>
    </>
  );
}
