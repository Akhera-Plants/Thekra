'use client';

import { useId, useMemo, useState } from 'react';
import { Bell, BellRing, ChevronDown, Repeat } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  applyStrategyToPlan,
  FARD_LABELS,
  isPaused,
  listedStrategies,
  MAX_LOOP_TEXT,
  setHeartPrefs,
  STRATEGY_KINDS,
  strategyApplyField,
  strategyAppliesToHabit,
  toggleStrategy,
  updatePlan,
  withCustomPeriodic,
  type Plan,
  type Strategy,
  type StrategyKind,
} from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Button } from '@/components/shared/kit/button';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { SegmentTabs } from '@/components/shared/kit/segment-tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { updateHeart } from '@/lib/practice/heart-store';
import { isPeriodicTemplate } from '@/lib/practice/limits';
import { newUuid } from '@/lib/practice/ids';
import { notificationPrefsOf, updatePrefs, updateStore } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import { applySuggestion, quoted, strategyTarget } from '@/lib/practice/strategies';
import { resendPushPrefs } from '@/lib/push/web-push';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeCatalog } from '../../hooks/usePracticeCatalog';
import { useWirdContext } from '../../hooks/useWirdContext';
import { EasyDeedsDialog } from '../EasyDeedsDialog';
import { HabitLoops } from '../LoopBuilder';
import { usePlanWords } from '../plan-words';
import { ConsistencyCard, HabitLoopCard, SinStepsCard } from './HabitCards';

type Filter = 'all' | StrategyKind;

/**
 * «استراتيجيات العادات» (owner round 6, C-18 a: the reference's layout, our visuals): a card «ابنِ حلقة تناسب عادتك»
 * (choose a habit, build its loop), the family filter «الكل · للبناء · للترك · للعودة», then the strategies in two
 * columns — each its idea, a folded example, its action («طبّقها على عادة» for a strategy that is one answer of a habit's
 * loop, «جرّبها» for the rest: «ترك», a season, «صحبة», the evening review; round 7, C2), and «ذكّرني بها» (the weekly
 * strategy reminder of «التنبيهات», practice-core `toggleStrategy`). «لا تفوّتها مرتين» still appears only in its moment
 * (a habit's row the day after a miss). «قبل أن تبدأ» keeps the educational cards.
 */
export function StrategiesView() {
  const t = useTranslations('practice.strategies');
  const english = useLocale() === 'en';
  const catalog = usePracticeCatalog();
  const context = useWirdContext();
  const [filter, setFilter] = useState<Filter>('all');
  const [deedsOpen, setDeedsOpen] = useState(false);
  /** «طبّقها على عادة»: the strategy being applied (null: none; 'loop': the card's own «ابنِ الحلقة»). */
  const [applying, setApplying] = useState<Strategy | 'loop' | null>(null);
  const listId = useId();

  const habits = useMemo(() => {
    if (!context) return [];
    const periodic = withCustomPeriodic((plan: Plan) => isPeriodicTemplate(habitOf(plan, context.habits)));
    return context.snapshot.store.plans.filter((plan) => !isPaused(plan) && !periodic(plan));
  }, [context]);
  const reminded = context ? notificationPrefsOf(context.snapshot.prefs).strategies : [];
  const shown = listedStrategies(filter);

  function toggleReminder(strategy: Strategy) {
    const on = !reminded.includes(strategy.key);
    updatePrefs((p) => {
      const notify = notificationPrefsOf(p);
      return { ...p, notify: { ...notify, strategies: toggleStrategy(notify.strategies, strategy.key) } };
    });
    void resendPushPrefs(english ? 'en' : 'ar');
    toast.success(on ? t('reminderOn') : t('reminderOff'));
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="strategy-loop-title" className="strategy-hero">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted-foreground">{t('loopKicker')}</p>
          <h2 id="strategy-loop-title" className="text-2xl font-medium md:text-[28px]">
            {t('loopTitle')}
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">{t('loopLead')}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:min-w-56">
          <Button variant="solid" tone="primary" size="md" icon={<Repeat aria-hidden />} onClick={() => setApplying('loop')}>
            {t('loopAction')}
          </Button>
        </div>
      </section>

      <section aria-labelledby="strategy-list-title" className="flex flex-col gap-6">
        {/* Round 7 (C1): the family filter sits under its heading, not on its line. */}
        <div className="flex flex-col items-start gap-4">
          <h2 id="strategy-list-title" className="text-2xl font-medium">
            {t('listHeading')}
          </h2>
          <SegmentTabs
            aria-label={t('filterLabel')}
            controls={listId}
            items={[{ value: 'all', label: t('kinds.all') }, ...STRATEGY_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))]}
            value={filter}
            onValueChange={(value) => setFilter(value as Filter)}
            className="w-auto"
          />
        </div>
        <ul id={listId} className="strategy-grid">
          {shown.map((strategy) => (
            <StrategyItem
              key={strategy.key}
              strategy={strategy}
              english={english}
              reminded={reminded.includes(strategy.key)}
              onReminder={() => toggleReminder(strategy)}
              onApply={() => setApplying(strategy)}
              onDeeds={() => setDeedsOpen(true)}
            />
          ))}
        </ul>
        <p className="text-sm leading-7 text-muted-foreground">{t('note')}</p>
      </section>

      <details className="group border-t border-border pt-2">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-xl font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          {t('cardsTitle')}
          <ChevronDown aria-hidden className="size-5 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="flex max-w-3xl flex-col gap-4 pb-2">
          <HabitLoopCard />
          <SinStepsCard withSource />
          <ConsistencyCard />
        </div>
      </details>

      <ApplyDialog
        applying={applying}
        onClose={() => setApplying(null)}
        habits={habits}
        catalog={context?.habits ?? new Map()}
        english={english}
      />
      <EasyDeedsDialog open={deedsOpen} onOpenChange={setDeedsOpen} slugs={catalog.data?.mujahada?.easyHighReward ?? []} />
    </div>
  );
}

/** One strategy: title, idea, a folded example, its action and «ذكّرني بها». */
function StrategyItem({
  strategy,
  english,
  reminded,
  onReminder,
  onApply,
  onDeeds,
}: {
  strategy: Strategy;
  english: boolean;
  reminded: boolean;
  onReminder: () => void;
  onApply: () => void;
  onDeeds: () => void;
}) {
  const t = useTranslations('practice.strategies');
  const target = strategyTarget(strategy.action);
  const title = english ? strategy.titleEn : strategy.titleAr;
  return (
    <li id={`strategy-${strategy.key}`} className="flex flex-col gap-3 border-b border-border py-6">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-xl font-medium">{title}</h3>
          <p className="text-base leading-8 text-muted-foreground">{t(`items.${strategy.key}.idea`)}</p>
        </div>
        <Button
          variant="ghost"
          tone="neutral"
          size="sm"
          aria-pressed={reminded}
          aria-label={t('remind', { title })}
          icon={reminded ? <BellRing aria-hidden /> : <Bell aria-hidden />}
          className="shrink-0 text-muted-foreground aria-pressed:text-primary-text"
          onClick={onReminder}
        >
          <span aria-hidden className="text-[13px]">
            {t('remindShort')}
          </span>
        </Button>
      </div>
      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          {t('exampleToggle')}
        </summary>
        <p className="pt-1 text-sm leading-7 text-muted-foreground">{t(`items.${strategy.key}.example`)}</p>
      </details>
      <div>
        {strategy.key === 'follow-good' ? (
          <Button variant="outline" tone="primary" size="sm" aria-haspopup="dialog" onClick={onDeeds}>
            {t('try')}
          </Button>
        ) : strategyAppliesToHabit(strategy.key) ? (
          <Button variant="outline" tone="primary" size="sm" aria-haspopup="dialog" onClick={onApply}>
            {t('apply')}
          </Button>
        ) : (
          <Button asChild variant="outline" tone="primary" size="sm">
            <Link href={target.href} onClick={target.heart ? () => updateHeart((h) => setHeartPrefs(h, target.heart ?? {})) : undefined}>
              {t('try')} <DirectionalArrow />
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * «طبّقها على عادة» (round 7, C2): choose one of the member's habits, then the ONE question of its loop this strategy
 * answers, asked about that habit («بعد أي صلاة تعمل «ورد القرآن»؟»), with an answer built from the habit when it says
 * something (practice-core `strategyApplyField`, `applyStrategyToPlan`). Saved into the habit's first loop; an answer it
 * replaces is shown first. «ابنِ الحلقة» (no strategy) opens the whole loop builder of the chosen habit. Without a
 * habit, one line and «أضف عادة».
 */
function ApplyDialog({
  applying,
  onClose,
  habits,
  catalog,
  english,
}: {
  applying: Strategy | 'loop' | null;
  onClose: () => void;
  habits: readonly Plan[];
  catalog: ReadonlyMap<string, PracticeHabit>;
  english: boolean;
}) {
  const t = useTranslations('practice.strategies');
  const [chosen, setChosen] = useState<string | null>(null);
  const strategy = applying && applying !== 'loop' ? applying : null;
  const plan = habits.find((p) => p.id === chosen) ?? (habits.length === 1 ? habits[0] : undefined);
  function close() {
    setChosen(null);
    onClose();
  }
  return (
    <Dialog open={applying !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pe-8">
          <DialogTitle className="leading-8">{strategy ? (english ? strategy.titleEn : strategy.titleAr) : t('loopTitle')}</DialogTitle>
          <DialogDescription className="leading-7">{strategy ? t(`items.${strategy.key}.idea`) : t('loopLead')}</DialogDescription>
        </DialogHeader>
        {habits.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-base leading-7">{t('noHabits')}</p>
            <Button asChild variant="solid" tone="primary" size="md">
              <Link href={{ pathname: '/practice', query: { add: '1' } }}>{t('addHabit')}</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium text-muted-foreground">{t('chooseHabit')}</legend>
              {habits.map((p) => (
                <HabitChoice key={p.id} plan={p} habit={habitOf(p, catalog)} checked={plan?.id === p.id} onChoose={() => setChosen(p.id)} />
              ))}
            </fieldset>
            {plan && strategy ? (
              <ApplyAnswer key={`${strategy.key}-${plan.id}`} strategy={strategy} plan={plan} habit={habitOf(plan, catalog)} onDone={close} />
            ) : plan ? (
              <HabitLoops key={plan.id} plan={plan} compact />
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The one loop question a strategy answers for the chosen habit, its answer, and «احفظ في حلقة العادة» · «إلغاء». */
function ApplyAnswer({ strategy, plan, habit, onDone }: { strategy: Strategy; plan: Plan; habit: PracticeHabit | undefined; onDone: () => void }) {
  const t = useTranslations('practice.strategies');
  const tLoops = useTranslations('practice.loops.habit.steps');
  const english = useLocale() === 'en';
  const words = usePlanWords(plan, habit);
  const id = useId();
  const field = strategyApplyField(strategy.key);
  const current = (field ? plan.loops?.[0]?.[field] : undefined)?.trim() ?? '';
  const suggestion = applySuggestion(
    strategy.key,
    plan,
    { amount: words.amount, prayer: (p) => FARD_LABELS[english ? 'en' : 'ar'].prayers[p] },
    (key, values) => t(key as never, values as never),
  );
  const [text, setText] = useState(suggestion || current);
  if (!field) return null;
  const replacing = current !== '' && text.trim() !== current;

  function save() {
    if (!field || !text.trim()) return;
    updateStore((store) =>
      updatePlan(store, plan.id, (p) =>
        applyStrategyToPlan(p, strategy.key, text, { loopId: newUuid(), routine: `${words.title}: ${words.amount(p.amount)}` }),
      ),
    );
    toast.success(t('applied', { habit: words.title }));
    onDone();
  }

  return (
    <form
      className="flex flex-col gap-3 border-t border-border pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-lg leading-8 font-medium">
          {t(`items.${strategy.key}.ask` as never, { habit: quoted(words.title, english) } as never)}
        </label>
        <p className="text-sm text-muted-foreground">{t('savedIn', { field: tLoops(`${field}.label`) })}</p>
      </div>
      <Textarea
        id={id}
        rows={3}
        maxLength={MAX_LOOP_TEXT}
        value={text}
        placeholder={t(`items.${strategy.key}.example`)}
        aria-describedby={replacing ? `${id}-current` : undefined}
        onChange={(event) => setText(event.target.value)}
      />
      {replacing ? (
        <p id={`${id}-current`} className="text-sm leading-7 text-muted-foreground">
          {t('replaces', { text: current })}
        </p>
      ) : null}
      <ActionPair>
        <Button type="submit" variant="solid" tone="primary" disabled={!text.trim()}>
          {t('saveApply')}
        </Button>
        <Button variant="outline" tone="neutral" onClick={onDone}>
          {t('cancel')}
        </Button>
      </ActionPair>
    </form>
  );
}

function HabitChoice({ plan, habit, checked, onChoose }: { plan: Plan; habit: PracticeHabit | undefined; checked: boolean; onChoose: () => void }) {
  const words = usePlanWords(plan, habit);
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
      <input type="radio" name="strategy-habit" className="size-4 accent-primary" checked={checked} onChange={onChoose} />
      <span lang={words.titleLang}>{words.title}</span>
    </label>
  );
}
