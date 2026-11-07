'use client';

import { Fragment, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, Settings2, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  HOME_SECTIONS,
  moveHomeSection,
  resolveHomeSections,
  seasonsOfGood,
  setHomeSectionVisible,
  setHomeSections,
  visibleHomeSections,
  type HabitItem,
  type HomeSectionKey,
} from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { OrnamentalDivider } from '@/components/home/OrnamentalDivider';
import { Button } from '@/components/shared/kit/button';
import { Switch } from '@/components/shared/kit/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/features/auth/hooks/useSession';
import { useAgendaActions } from '@/features/practice/hooks/useAgendaActions';
import { usePracticeCatalog } from '@/features/practice/hooks/usePracticeCatalog';
import { usePracticeStore } from '@/features/practice/hooks/usePracticeStore';
import { useToday } from '@/features/practice/hooks/useToday';
import { useWirdContext, type WirdContext } from '@/features/practice/hooks/useWirdContext';
import { WeekBranchCard } from '@/features/practice/components/hub/KnowledgeCards';
import { usePlanWords } from '@/features/practice/components/plan-words';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import { wirdDay } from '@/lib/practice/wird';
import type { Plan } from '@thekra/practice-core';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';

/** Remembers the last answer, so a signed-in user does not see the guest page flash first. Per-device convenience only. */
const SIGNED_IN_HINT = 'thekra.home.signed-in';

function readHint(): boolean {
  try {
    return window.localStorage.getItem(SIGNED_IN_HINT) === '1';
  } catch {
    return false;
  }
}

function writeHint(signedIn: boolean) {
  try {
    if (signedIn) window.localStorage.setItem(SIGNED_IN_HINT, '1');
    else window.localStorage.removeItem(SIGNED_IN_HINT);
  } catch {
    // Storage blocked (private window): the page still works, the member sections may only appear after loading.
  }
}

const noSubscribe = () => () => {};

/** Signed in. False during the server render: the home is cached and the same for everyone. */
function useSignedIn(): boolean {
  const session = useSession();
  const hint = useSyncExternalStore(noSubscribe, readHint, () => false);
  // Same as the server render until mounted: the session can resolve before the home hydrates (React error 418).
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const known = mounted && !session.isLoading;
  useEffect(() => {
    if (known) writeHint(session.isAuthenticated);
  }, [known, session.isAuthenticated]);
  return known ? session.isAuthenticated : hint;
}

/** Sections the website has. «نص اليوم» is the app's (the site has no such text yet), so it is never drawn here. */
const WEB_SECTIONS: readonly HomeSectionKey[] = HOME_SECTIONS.map((s) => s.key).filter((key) => key !== 'daily-text');

/** After these a divider parts the page (the reading sections below the doors keep their own spacing, as before). */
const DIVIDED_AFTER: ReadonlySet<HomeSectionKey> = new Set(['wird', 'week-branch', 'doors']);

interface HomeSectionsProps {
  /** The server-rendered sections (the public, cached part of the page). */
  doors: ReactNode;
  moments: ReactNode;
  featured: ReactNode;
  sources: ReactNode;
}

/**
 * The home (round 5, F-02 a / F-33): a visitor always sees the fixed public order (practice-core `visibleHomeSections`
 * for a visitor: «مناسبة قريبة» when one is near, then the doors and the reading sections). A signed-in member sees
 * their own order and choice, synced with the app (`settings.homeSections`), with «ورد اليوم» first by default, and
 * «خصّص الرئيسية» at the end (show/hide and move up/down). «مواسم الخير» is gone (F-17): the occasions live in «سجلّي».
 */
export function HomeSections({ doors, moments, featured, sources }: HomeSectionsProps) {
  const signedIn = useSignedIn();
  const snapshot = usePracticeStore();
  const stored = snapshot?.store.settings.homeSections;
  const keys = useMemo(() => {
    const list = visibleHomeSections(signedIn ? stored : null, signedIn);
    // A visitor's order leaves out what is opt-in («شعبة الأسبوع» is a member's choice).
    return list.filter(
      (key) => WEB_SECTIONS.includes(key) && (signedIn || HOME_SECTIONS.find((s) => s.key === key)?.visibleByDefault),
    );
  }, [signedIn, stored]);

  const render: Record<HomeSectionKey, () => ReactNode> = {
    wird: () => <HomeWird />,
    'daily-text': () => null,
    'week-branch': () => <HomeWeekBranch />,
    occasion: () => <HomeOccasion />,
    doors: () => doors,
    moments: () => moments,
    featured: () => featured,
    sources: () => sources,
  };

  return (
    <>
      {keys.map((key, index) => (
        <Fragment key={key}>
          {render[key]()}
          {DIVIDED_AFTER.has(key) && index < keys.length - 1 ? <OrnamentalDivider /> : null}
        </Fragment>
      ))}
      {signedIn && snapshot ? <CustomizeHome /> : null}
    </>
  );
}

/** «ورد اليوم» on the home: what is left today, and a circle for each unchecked habit that logs it there. */
function HomeWird() {
  const context = useWirdContext({ catalogOnlyWithPlans: true });
  if (!context) return <section className="home-wird min-h-28" aria-busy="true" />;
  return <HomeWirdBody context={context} />;
}

function HomeWirdBody({ context }: { context: WirdContext }) {
  const t = useTranslations('home.wird');
  const tNav = useTranslations('nav.menuItems');
  const { snapshot, today, occasions, planDays, habits } = context;
  const { store } = snapshot;
  const { toggleHabit } = useAgendaActions();
  const day = useMemo(() => wirdDay(store, today, { occasions, ...planDays }), [store, today, occasions, planDays]);
  const habitsToday = [...day.open, ...day.done].filter((item): item is HabitItem => item.kind === 'habit');
  const open = day.open.filter((item): item is HabitItem => item.kind === 'habit');
  const done = habitsToday.length - open.length;
  const total = habitsToday.length;

  return (
    <section aria-labelledby="home-wird-title" className="home-wird flex flex-col gap-4 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="home-wird-title" className="text-2xl font-medium">
            {tNav('wird')}
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            {store.plans.length === 0
              ? t('empty')
              : total === 0
                ? t('rest')
                : open.length === 0
                  ? t('done')
                  : t('progress', { done: formatDigits(done), total: formatDigits(total) })}
          </p>
        </div>
        <Link href={store.plans.length === 0 ? { pathname: '/practice', query: { add: '1' } } : '/practice'} className="outline-button">
          {store.plans.length === 0 ? t('start') : t('open')} <DirectionalArrow />
        </Link>
      </div>
      {total > 0 ? (
        <div aria-hidden className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary transition-[inline-size] duration-300 motion-reduce:transition-none" style={{ inlineSize: `${Math.round((done / total) * 100)}%` }} />
        </div>
      ) : null}
      {open.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t('openList')}>
          {open.map((item) => {
            const plan = store.plans.find((p) => p.id === item.planId);
            return plan ? (
              <HomeCircle key={item.planId} plan={plan} habit={habitOf(plan, habits)} onLog={() => toggleHabit(item, today, today)} />
            ) : null;
          })}
        </ul>
      ) : null}
    </section>
  );
}

function HomeCircle({ plan, habit, onLog }: { plan: Plan; habit: PracticeHabit | undefined; onLog: () => void }) {
  const t = useTranslations('home.wird');
  const words = usePlanWords(plan, habit);
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={false}
        aria-label={t('log', { title: words.title })}
        onClick={() => {
          onLog();
          toast.success(t('logged', { title: words.title }));
        }}
        className="group/check flex min-h-11 items-center gap-2 rounded-full border border-border bg-card py-1 ps-1.5 pe-4 text-sm transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full border-2 border-primary/60 transition-[transform,background-color] duration-150 group-hover/check:border-primary group-active/check:scale-90 motion-reduce:group-active/check:scale-100 dark:border-ring/70"
        >
          <Check className="size-3.5 opacity-0 group-hover/check:opacity-40" strokeWidth={3} />
        </span>
        <span lang={words.titleLang}>{words.title}</span>
      </button>
    </li>
  );
}

function HomeWeekBranch() {
  const clock = useToday();
  if (!clock) return null;
  return (
    <div className="pt-8">
      <WeekBranchCard today={clock.today} />
    </div>
  );
}

/** Days ahead «مناسبة قريبة» looks (F-17: a near occasion only). */
const OCCASION_HORIZON = 10;

/** «مناسبة قريبة»: the next occasion that does not come every week, within ten days (or today's), as one line. */
function HomeOccasion() {
  const t = useTranslations('home.occasion');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const clock = useToday();
  const snapshot = usePracticeStore();
  const catalog = usePracticeCatalog();
  const offset = snapshot?.store.settings.hijriOffset ?? 0;
  const found = useMemo(() => {
    if (!clock || !catalog.data) return null;
    const rare = catalog.data.occasions.filter((o) => o.rule.kind !== 'weekdays');
    const seasons = seasonsOfGood(rare, clock.today, { hijriOffset: offset, horizon: OCCASION_HORIZON });
    const today = seasons.today[0];
    if (today) return { occasion: today, inDays: 0, date: clock.today };
    return seasons.next ? { occasion: seasons.next.occasion, inDays: seasons.next.inDays, date: seasons.next.date } : null;
  }, [clock, catalog.data, offset]);
  if (!found) return null;
  const title = locale === 'en' ? found.occasion.titleEn : found.occasion.titleAr;
  return (
    <section aria-label={t('label')} className="pt-6">
      <Link
        href={`/good-deeds/${found.occasion.deed}`}
        className="group flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Sparkles aria-hidden className="size-5 shrink-0 text-intent-good-deed" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-medium text-muted-foreground">{t('label')}</span>
          <span className="text-base font-medium">{title}</span>
        </span>
        <span className="shrink-0 text-sm text-muted-foreground">
          {found.inDays === 0
            ? t('today')
            : found.inDays === 1
              ? t('tomorrow')
              : t('inDays', { count: found.inDays, n: formatDigits(found.inDays), date: formatGregorian(found.date, locale) })}
        </span>
        <DirectionalArrow className="size-4 text-muted-foreground" />
      </Link>
    </section>
  );
}

/** «خصّص الرئيسية»: show/hide and move each section; every change is saved at once (synced with the app). */
function CustomizeHome() {
  const t = useTranslations('home.customize');
  const snapshot = usePracticeStore();
  const [open, setOpen] = useState(false);
  const list = resolveHomeSections(snapshot?.store.settings.homeSections).filter((s) => WEB_SECTIONS.includes(s.key));
  const title = (key: HomeSectionKey) => t(`sections.${key}`);

  function move(key: HomeSectionKey, by: -1 | 1) {
    const at = list.findIndex((s) => s.key === key);
    const other = list[at + by];
    if (!other) return;
    updateStore((store) => {
      const full = resolveHomeSections(store.settings.homeSections);
      return setHomeSections(store, moveHomeSection(full, key, full.findIndex((s) => s.key === other.key)));
    });
  }

  return (
    <div className="flex justify-center pt-6 pb-2">
      <Button variant="outline" tone="neutral" icon={<Settings2 aria-hidden />} onClick={() => setOpen(true)}>
        {t('open')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) toast.success(t('saved'));
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-md">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{t('open')}</DialogTitle>
            <DialogDescription className="leading-7">{t('lead')}</DialogDescription>
          </DialogHeader>
          <ol className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto border-y border-border">
            {list.map((section, index) => (
              <li key={section.key} className="flex min-h-14 items-center gap-2 py-1.5">
                <span className={cn('min-w-0 flex-1 text-base', !section.visible && 'text-muted-foreground')}>{title(section.key)}</span>
                <Button
                  variant="ghost"
                  tone="neutral"
                  size="sm"
                  iconOnly
                  icon={<ArrowUp aria-hidden />}
                  aria-label={t('up', { title: title(section.key) })}
                  disabled={index === 0}
                  onClick={() => move(section.key, -1)}
                />
                <Button
                  variant="ghost"
                  tone="neutral"
                  size="sm"
                  iconOnly
                  icon={<ArrowDown aria-hidden />}
                  aria-label={t('down', { title: title(section.key) })}
                  disabled={index === list.length - 1}
                  onClick={() => move(section.key, 1)}
                />
                <Switch
                  aria-label={t('show', { title: title(section.key) })}
                  checked={section.visible}
                  onCheckedChange={(on) =>
                    updateStore((store) => setHomeSections(store, setHomeSectionVisible(store.settings.homeSections, section.key, on)))
                  }
                />
              </li>
            ))}
          </ol>
          <Button
            className="self-start"
            onClick={() => {
              setOpen(false);
              toast.success(t('saved'));
            }}
          >
            {t('done')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
