'use client';

import { useId, useState, type ReactNode } from 'react';
import { BellOff, BellRing, ChevronDown, ExternalLink, Laptop, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  activePeriodicActs,
  isPaused,
  listedStrategies,
  setHeartPrefs,
  toggleStrategy,
  withCustomPeriodic,
  type HeartPrefs,
  type NotificationPrefs,
  type Plan,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { Switch } from '@/components/shared/kit/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link } from '@/i18n/navigation';
import { EXTENSION_STORE_URL } from '@/lib/extension';
import { formatDigits } from '@/lib/format/digits';
import { updateHeart } from '@/lib/practice/heart-store';
import { isPeriodicTemplate } from '@/lib/practice/limits';
import { notificationPrefsOf, updatePrefs } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import { loadPushConfig, resendPushPrefs } from '@/lib/push/web-push';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { PracticeHabit } from '@/lib/types/practice';
import { useHeart } from '../../hooks/useHeart';
import { usePushReminders } from '../../hooks/usePushReminders';
import { useWirdContext } from '../../hooks/useWirdContext';
import { usePlanWords } from '../plan-words';
import { PracticeLoading } from '../PracticeLoading';
import { PushRemindersCard } from '../PushRemindersCard';
import { TimeField } from '../TimeField';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** One channel group: its title and its rows (a hairline list). */
function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <h2 id={id} className="text-xl font-medium">
        {title}
      </h2>
      <ul className="flex flex-col divide-y divide-border">{children}</ul>
    </section>
  );
}

/** A switch row: the label (and its hint) on the reading start, the switch on the end. */
function SwitchRow({
  label,
  labelLang,
  hint,
  checked,
  onChange,
}: {
  label: string;
  labelLang?: string;
  hint?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <li className="flex min-h-14 items-center justify-between gap-4 py-2">
      <span className="flex min-w-0 flex-col">
        <span id={labelId} lang={labelLang} className="text-base leading-7">
          {label}
        </span>
        {hint ? (
          <span id={hintId} className="text-sm leading-6 text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      <Switch aria-labelledby={labelId} aria-describedby={hint ? hintId : undefined} checked={checked} onCheckedChange={onChange} />
    </li>
  );
}

/**
 * A day or a time as a value row (A-29 a: one style for both): the title on the reading start, the value on the end with
 * a chevron; a tap opens its picker under it.
 */
function ValueRow({ label, value, children }: { label: string; value: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${value}`}
            className="flex min-h-12 w-full items-center gap-3 py-2 ps-4 text-start transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">{label}</span>
            <span className="text-base tabular-nums" dir="auto">
              {value}
            </span>
            <ChevronDown aria-hidden className={cn('size-4 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-3">
          {children(() => setOpen(false))}
        </PopoverContent>
      </Popover>
    </li>
  );
}

function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (time: string) => void }) {
  const id = useId();
  return (
    <ValueRow label={label} value={formatDigits(value)}>
      {() => <TimeField id={id} label={label} value={value} onChange={onChange} />}
    </ValueRow>
  );
}

function DayRow({ label, value, onChange }: { label: string; value: number; onChange: (day: number) => void }) {
  const tDays = useTranslations('practice.weekdays');
  return (
    <ValueRow label={label} value={tDays(`d${value}`)}>
      {(close) => (
        <div role="radiogroup" aria-label={label} className="flex w-44 flex-col">
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={value === d}
              onClick={() => {
                onChange(d);
                close();
              }}
              className={cn(
                'min-h-11 rounded-md px-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                value === d ? 'bg-primary/10 font-medium text-primary-text' : 'hover:bg-muted',
              )}
            >
              {tDays(`d${d}`)}
            </button>
          ))}
        </div>
      )}
    </ValueRow>
  );
}

/** The tabs of «التنبيهات» (round 6, C-19; practice-core `NOTIFICATION_GROUPS`), in order. */
const TABS = ['habits', 'periodic', 'heart', 'strategies'] as const;
type NotifyTab = (typeof TABS)[number];

/** Adds or removes an id from a mute list. */
function toggled(list: readonly string[], id: string, muted: boolean): string[] {
  return muted ? [...new Set([...list, id])] : list.filter((entry) => entry !== id);
}

/**
 * «التنبيهات» (owner round 6, C-19: «خذ تصميمه … خلي كل وحدة تاب»): four tabs, the reference's rows —
 * «العادات» (every habit's own switch) · «الأعمال الدورية» (only the member's active acts, each
 * with its switch; none → an add button; «مناسبة قريبة») · «النية والمحاسبة» (نية اليوم، محاسبة المساء، المحاسبة
 * الأسبوعية) · «الاستراتيجيات» (the strategies reminded once a week, the day and the time). On a wide screen the browser's
 * push status and switch sit in a side column. No calendar file any more (C-19). Per-habit and per-act switches are
 * practice-core `mutedPlans` / `mutedActs`, sent with this browser's push subscription. «تخفَّف» has no reminder in a
 * browser: push is planned by the server, and the sin never reaches it.
 */
export function NotificationsSettings() {
  const t = useTranslations('practice.notify');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const context = useWirdContext();
  const heart = useHeart();
  const [tab, setTab] = useState<NotifyTab>('habits');
  if (!context || !heart) return <PracticeLoading />;
  const notify = notificationPrefsOf(context.snapshot.prefs);
  const { store } = context.snapshot;

  function setNotify(patch: Partial<NotificationPrefs>) {
    updatePrefs((p) => ({ ...p, notify: { ...notificationPrefsOf(p), ...patch } }));
    void resendPushPrefs(locale);
  }
  const setHeart = (patch: Partial<HeartPrefs>) => updateHeart((h) => setHeartPrefs(h, patch));
  const eveningOn = heart.prefs.eveningReview || notify.eveningNudge;
  const weeklyOn = heart.prefs.fridayReview || notify.fridayReview;
  const anyOn = notify.habits || notify.periodic || eveningOn || weeklyOn || notify.occasions || notify.intentionReminder || notify.strategies.length > 0;

  const periodicTest = withCustomPeriodic((plan: Plan) => isPeriodicTemplate(habitOf(plan, context.habits)));
  const habitPlans = store.plans.filter((plan) => !isPaused(plan) && !periodicTest(plan));
  const acts = activePeriodicActs(store);

  return (
    <div className="notify-layout">
      <div className="flex min-w-0 flex-col gap-6">
        <SegmentTabs
          aria-label={t('title')}
          items={TABS.map((value) => ({ value, label: t(`tabs.${value}`) }))}
          value={tab}
          onValueChange={(value) => setTab(value as NotifyTab)}
          variant="underline"
          size="filled"
          className="[&_[data-slot=tabs-list]]:justify-start [&_[data-slot=tabs-list]]:overflow-x-auto [&_[data-slot=tabs-list]]:overscroll-x-contain [&_[data-slot=tabs-list]]:[scrollbar-width:none] [&_[data-slot=tabs-trigger]]:min-h-12 [&_[data-slot=tabs-trigger]]:min-w-fit [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:text-[15px]"
        >
          <SegmentTabsContent value="habits" className="pt-6">
            <Group id="notify-habits" title={t('tabs.habits')}>
              <SwitchRow label={t('habits')} hint={t('habitsHint')} checked={notify.habits} onChange={(on) => setNotify({ habits: on })} />
              {notify.habits
                ? habitPlans.map((plan) => (
                    <PlanSwitchRow
                      key={plan.id}
                      plan={plan}
                      habit={habitOf(plan, context.habits)}
                      checked={!notify.mutedPlans.includes(plan.id)}
                      onChange={(on) => setNotify({ mutedPlans: toggled(notify.mutedPlans, plan.id, !on) })}
                    />
                  ))
                : null}
              {habitPlans.length === 0 ? <EmptyRow text={t('noHabits')} href="/practice" action={t('addHabit')} /> : null}
            </Group>
          </SegmentTabsContent>

          <SegmentTabsContent value="periodic" className="pt-6">
            <Group id="notify-periodic" title={t('tabs.periodic')}>
              {acts.length === 0 ? (
                <EmptyRow text={t('noPeriodic')} href="/practice/periodic" action={t('addPeriodic')} />
              ) : (
                <>
                  <SwitchRow label={t('periodicAll')} checked={notify.periodic} onChange={(on) => setNotify({ periodic: on })} />
                  {notify.periodic ? (
                    <>
                      <TimeRow label={t('time')} value={notify.periodicTime} onChange={(time) => setNotify({ periodicTime: time })} />
                      {acts.map((act) =>
                        act.info ? (
                          <SwitchRow
                            key={act.key}
                            label={locale === 'en' ? act.info.en : act.info.ar}
                            checked={!notify.mutedActs.includes(act.key)}
                            onChange={(on) => setNotify({ mutedActs: toggled(notify.mutedActs, act.key, !on) })}
                          />
                        ) : act.plans[0] ? (
                          <PlanSwitchRow
                            key={act.key}
                            plan={act.plans[0]}
                            habit={undefined}
                            checked={!notify.mutedPlans.includes(act.plans[0].id)}
                            onChange={(on) => setNotify({ mutedPlans: toggled(notify.mutedPlans, act.plans[0]!.id, !on) })}
                          />
                        ) : null,
                      )}
                    </>
                  ) : null}
                </>
              )}
              <SwitchRow label={t('occasion')} hint={t('occasionHint')} checked={notify.occasions} onChange={(on) => setNotify({ occasions: on })} />
              {notify.occasions ? (
                <TimeRow label={t('time')} value={notify.occasionTime} onChange={(time) => setNotify({ occasionTime: time })} />
              ) : null}
            </Group>
          </SegmentTabsContent>

          <SegmentTabsContent value="heart" className="pt-6">
            <Group id="notify-heart" title={t('tabs.heart')}>
              <SwitchRow
                label={t('intention')}
                hint={t('intentionHint')}
                checked={notify.intentionReminder}
                onChange={(on) => setNotify({ intentionReminder: on })}
              />
              {notify.intentionReminder ? (
                <TimeRow label={t('time')} value={notify.intentionTime} onChange={(time) => setNotify({ intentionTime: time })} />
              ) : null}
              {/* «محاسبة المساء»: the review card and its evening reminder, one switch (as since round 5). */}
              <SwitchRow
                label={t('eveningReview')}
                checked={eveningOn}
                onChange={(on) => {
                  setHeart({ eveningReview: on });
                  setNotify({ eveningNudge: on, eveningTime: heart.prefs.eveningFrom });
                }}
              />
              {eveningOn ? (
                <TimeRow
                  label={t('time')}
                  value={heart.prefs.eveningFrom}
                  onChange={(time) => {
                    setHeart({ eveningFrom: time });
                    setNotify({ eveningTime: time });
                  }}
                />
              ) : null}
              <SwitchRow
                label={t('weeklyReview')}
                checked={weeklyOn}
                onChange={(on) => {
                  setHeart({ fridayReview: on });
                  setNotify({ fridayReview: on });
                }}
              />
              {weeklyOn ? (
                <>
                  <DayRow
                    label={t('day')}
                    value={heart.prefs.reviewDay}
                    onChange={(day) => {
                      setHeart({ reviewDay: day });
                      setNotify({ reviewDay: day });
                    }}
                  />
                  <TimeRow label={t('time')} value={notify.fridayTime} onChange={(time) => setNotify({ fridayTime: time })} />
                </>
              ) : null}
            </Group>
          </SegmentTabsContent>

          <SegmentTabsContent value="strategies" className="pt-6">
            <Group id="notify-strategies" title={t('tabs.strategies')}>
              <li className="py-3 text-sm leading-7 text-muted-foreground">{t('strategiesLead')}</li>
              {listedStrategies().map((strategy) => (
                <SwitchRow
                  key={strategy.key}
                  label={locale === 'en' ? strategy.titleEn : strategy.titleAr}
                  checked={notify.strategies.includes(strategy.key)}
                  onChange={() => setNotify({ strategies: toggleStrategy(notify.strategies, strategy.key) })}
                />
              ))}
              {notify.strategies.length > 0 ? (
                <>
                  <DayRow label={t('day')} value={notify.strategyDay} onChange={(day) => setNotify({ strategyDay: day })} />
                  <TimeRow label={t('time')} value={notify.strategyTime} onChange={(time) => setNotify({ strategyTime: time })} />
                </>
              ) : null}
            </Group>
          </SegmentTabsContent>
        </SegmentTabs>
      </div>

      {/* The side column (reference: «تذكير بلا إزعاج»): what reaches this browser, its switch, the quiet hours. */}
      <aside aria-labelledby="notify-browser" className="notify-aside flex flex-col gap-4">
        <h2 id="notify-browser" className="text-xl font-medium">
          {t('groupBrowser')}
        </h2>
        <StatusLine anyOn={anyOn} />
        <PushRemindersCard />
        <p className="text-sm leading-7 text-muted-foreground">{t('quiet')}</p>
        {/* «تذكير على حاسوبك» once the owner publishes the extension (F-25 b); hidden until then. */}
        {EXTENSION_STORE_URL ? (
          <a
            href={EXTENSION_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 items-center gap-3 border-y border-border py-2 transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Laptop className="size-5 shrink-0 text-primary-text" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span>{t('extension')}</span>
              <span className="text-sm text-muted-foreground">{t('extensionHint')}</span>
            </span>
            <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
          </a>
        ) : null}
      </aside>
    </div>
  );
}

/** One habit's own switch (its title as «عاداتي» names it). */
function PlanSwitchRow({ plan, habit, checked, onChange }: { plan: Plan; habit: PracticeHabit | undefined; checked: boolean; onChange: (on: boolean) => void }) {
  const words = usePlanWords(plan, habit);
  return <SwitchRow label={words.title} labelLang={words.titleLang} checked={checked} onChange={onChange} />;
}

/** Nothing to remind yet: one line and the way to add it. */
function EmptyRow({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <span className="text-base leading-7 text-muted-foreground">{text}</span>
      <Button asChild variant="outline" tone="primary" size="sm">
        <Link href={href}>
          <Plus aria-hidden />
          {action}
        </Link>
      </Button>
    </li>
  );
}

/**
 * Only what is true (F-29 a): every switch off; this browser receives them; it does not yet (the card under it says
 * why and how); or push cannot reach this browser at all.
 */
function StatusLine({ anyOn }: { anyOn: boolean }) {
  const t = useTranslations('practice.notify.status');
  const { state } = usePushReminders();
  const config = useQuery({ queryKey: queryKeys.push.config, queryFn: loadPushConfig, staleTime: Infinity });
  let text: string | null = null;
  let on = false;
  if (!anyOn) text = t('allOff');
  else if (state === 'on') {
    text = t('pushOn');
    on = true;
  } else if (state === 'unsupported' || (state === 'hidden' && config.data?.enabled === false)) text = t('unavailable');
  else if (state !== 'hidden') text = t('pushOff');
  if (!text) return null;
  const Icon = on ? BellRing : BellOff;
  return (
    <p role="status" className="flex items-start gap-2 text-base leading-7">
      <Icon className={cn('mt-1 size-5 shrink-0', on ? 'text-primary-text' : 'text-muted-foreground')} aria-hidden />
      <span>{text}</span>
    </p>
  );
}
