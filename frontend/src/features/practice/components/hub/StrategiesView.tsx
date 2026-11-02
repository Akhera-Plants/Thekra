'use client';

import { useMemo, useState } from 'react';
import { Bell, BellOff, Lightbulb } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { isPaused, setHeartPrefs, STRATEGIES, toggleStrategy, type NotificationPrefs, type Strategy } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { CatalogName } from '@/components/shared/CatalogName';
import { Button } from '@/components/shared/kit/button';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { updateHeart } from '@/lib/practice/heart-store';
import { notificationPrefsOf, updatePrefs } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import { limitOptions } from '@/lib/practice/limits';
import { listedStrategies, strategyTarget } from '@/lib/practice/strategies';
import { queryKeys } from '@/lib/query-keys';
import type { GoodDeedsQuery } from '@/lib/types/api';
import type { LocaleCode } from '@/lib/types/enums';
import { resendPushPrefs } from '@/lib/push/web-push';
import { cn } from '@/lib/utils';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { HabitLoops } from '../LoopBuilder';
import { usePlanWords } from '../PlanCard';
import { PracticeLoading } from '../PracticeLoading';
import { ConsistencyCard, HabitLoopCard, SinStepsCard } from './HabitCards';

/**
 * «استراتيجيات العادات» (owner round 3, items 13, 14, 17): «قبل أن تبدأ» (the two cards and the three facts), then
 * «ابنِ حلقة عادتك الخاصة» (pick a habit, build its loops), then the strategies. Each one is one general line,
 * «جرّبها» (the feature it maps to; «أتبِع السيئةَ الحسنة» lists easy deeds with a great reward), «مثال» (a popup with
 * a concrete example) and «ذكّرني بها» (at most one reminder a week). «لا تفوّتها مرتين» is not listed: it shows in
 * context, on a habit's row the day after it was missed.
 */
export function StrategiesView() {
  const t = useTranslations('practice.strategies');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const context = useWirdContext();
  const [goodDeedsOpen, setGoodDeedsOpen] = useState(false);
  if (!context) return <PracticeLoading />;
  const notify = notificationPrefsOf(context.snapshot.prefs);

  function setNotify(patch: Partial<NotificationPrefs>) {
    updatePrefs((p) => ({ ...p, notify: { ...notificationPrefsOf(p), ...patch } }));
    void resendPushPrefs(locale);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section aria-labelledby="strategy-cards-title" className="flex flex-col gap-4">
        <h2 id="strategy-cards-title" className="text-xl font-medium">
          {t('cardsTitle')}
        </h2>
        <HabitLoopCard />
        <SinStepsCard withSource />
        <ConsistencyCard />
      </section>

      <SectionDivider />

      <LoopSection context={context} />

      <SectionDivider />

      <section aria-labelledby="strategy-list-title" className="flex flex-col gap-3">
        <h2 id="strategy-list-title" className="text-xl font-medium">
          {t('title')}
        </h2>
        <p className="text-sm leading-7 text-muted-foreground">{t('remindHint')}</p>
        <ol className="flex flex-col divide-y divide-border border-y border-border">
          {listedStrategies(STRATEGIES).map((strategy) => (
            <StrategyRow
              key={strategy.key}
              strategy={strategy}
              english={locale === 'en'}
              reminding={notify.strategies.includes(strategy.key)}
              onRemind={() => setNotify({ strategies: toggleStrategy(notify.strategies, strategy.key) })}
              onGoodDeeds={() => setGoodDeedsOpen(true)}
            />
          ))}
        </ol>
      </section>

      <GoodDeedsDialog open={goodDeedsOpen} onOpenChange={setGoodDeedsOpen} slugs={context.catalog.data?.mujahada?.easyHighReward ?? []} />
    </div>
  );
}

/** «ابنِ حلقة عادتك الخاصة»: pick one of the member's habits, then build, view and edit its loops. */
function LoopSection({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.loops');
  // Habits only: periodic acts are reminders, not habits.
  const { isPeriodicAct } = limitOptions(context.habits);
  const plans = context.snapshot.store.plans.filter((p) => !isPaused(p) && !(isPeriodicAct?.(p) ?? false));
  const [picked, setPicked] = useState<string | null>(null);
  const plan = plans.find((p) => p.id === picked) ?? plans[0];
  return (
    <section aria-labelledby="loop-builder-title" className="flex flex-col gap-4">
      <h2 id="loop-builder-title" className="text-xl font-medium">
        {t('habit.sectionTitle')}
      </h2>
      {plans.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border p-4">
          <p className="text-muted-foreground">{t('habit.noHabits')}</p>
          <Link href={{ pathname: '/practice/habits', query: { add: '1' } }} className="outline-button">
            {t('habit.addHabit')} <DirectionalArrow />
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground" id="loop-habit-label">
              {t('habit.pick')}
            </p>
            <ul className="flex flex-wrap gap-2" aria-labelledby="loop-habit-label">
              {plans.map((p) => (
                <li key={p.id}>
                  <HabitChip plan={p} context={context} pressed={plan?.id === p.id} onPick={() => setPicked(p.id)} />
                </li>
              ))}
            </ul>
          </div>
          {plan ? <HabitLoops key={plan.id} plan={plan} /> : null}
        </>
      )}
    </section>
  );
}

function HabitChip({ plan, context, pressed, onPick }: { plan: WirdContext['snapshot']['store']['plans'][number]; context: WirdContext; pressed: boolean; onPick: () => void }) {
  const words = usePlanWords(plan, habitOf(plan, context.habits));
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPick}
      className={cn(
        'min-h-11 rounded-lg border px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        pressed ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary',
      )}
    >
      <span lang={words.titleLang}>{words.title}</span>
    </button>
  );
}

function StrategyRow({
  strategy,
  english,
  reminding,
  onRemind,
  onGoodDeeds,
}: {
  strategy: Strategy;
  english: boolean;
  reminding: boolean;
  onRemind: () => void;
  onGoodDeeds: () => void;
}) {
  const t = useTranslations('practice.strategies');
  const target = strategyTarget(strategy.action);
  return (
    <li id={`strategy-${strategy.key}`} className="flex flex-col gap-2 py-4">
      <h3 className="text-lg font-medium">{english ? strategy.titleEn : strategy.titleAr}</h3>
      <p className="text-base leading-8">{t(`items.${strategy.key}.idea`)}</p>
      <div className="flex flex-wrap items-center gap-2">
        {strategy.key === 'follow-good' ? (
          <button type="button" className="outline-button button-wrap !mt-0 !min-h-11" aria-haspopup="dialog" onClick={onGoodDeeds}>
            {t('try')}
          </button>
        ) : (
          <Link
            href={target.href}
            className="outline-button button-wrap !mt-0 !min-h-11"
            onClick={target.heart ? () => updateHeart((h) => setHeartPrefs(h, target.heart ?? {})) : undefined}
          >
            {t('try')} <DirectionalArrow />
          </Link>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="outline-button !mt-0 !min-h-11">
              <Lightbulb aria-hidden />
              {t('example')}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 text-sm leading-7">
            {t(`items.${strategy.key}.example`)}
          </PopoverContent>
        </Popover>
        <button type="button" className="outline-button !mt-0 !min-h-11" aria-pressed={reminding} onClick={onRemind}>
          {reminding ? <BellOff aria-hidden /> : <Bell aria-hidden />}
          {reminding ? t('remindOff') : t('remind')}
        </button>
      </div>
    </li>
  );
}

/** «أتبِع السيئةَ الحسنة»: easy deeds with a great reward (catalog `easyHighReward`), each opening its page. */
function GoodDeedsDialog({ open, onOpenChange, slugs }: { open: boolean; onOpenChange: (open: boolean) => void; slugs: readonly string[] }) {
  const t = useTranslations('practice.strategies.goodDeeds');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const params = useMemo<GoodDeedsQuery>(() => ({ limit: 100, lang: locale as LocaleCode, includeEmpty: 'true' }), [locale]);
  const deeds = useQuery({
    queryKey: queryKeys.goodDeeds.list(params),
    queryFn: async () => (await getGoodDeeds(params)).data,
    enabled: open && slugs.length > 0,
    staleTime: 60 * 60 * 1000,
  });
  const bySlug = new Map((deeds.data ?? []).map((d) => [d.slug, d]));
  const shown = slugs.flatMap((slug) => bySlug.get(slug) ?? []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('lead')}</DialogDescription>
        </DialogHeader>
        {shown.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {shown.map((deed) => (
              <li key={deed.slug}>
                <Button asChild variant="outline" tone="primary" className="h-auto min-h-11 w-full justify-between py-2 whitespace-normal">
                  <Link href={`/good-deeds/${deed.slug}`}>
                    <CatalogName nameAr={deed.nameAr} name={deed.name} />
                    <DirectionalArrow />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{deeds.isPending && slugs.length > 0 ? t('loading') : t('none')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
