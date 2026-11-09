'use client';

import { useId, useMemo, useState } from 'react';
import { Check, HeartHandshake, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  activePeriodicActs,
  addDays,
  createCustomPeriodic,
  limits,
  parseDate,
  PERIODIC_ACTS,
  upsertPlan,
  type LimitKind,
  type PeriodicActInfo,
  type Plan,
  type Rule,
} from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Button } from '@/components/shared/kit/button';
import { TitleRow } from '@/components/shared/kit/title-row';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { newUuid } from '@/lib/practice/ids';
import { limitOptions, planFromTemplate } from '@/lib/practice/limits';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import { periodicActsOnly } from '@/lib/practice/wird';
import type { PracticeHabit } from '@/lib/types/practice';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { DayChips } from '../DayChips';
import { DeleteDialog } from '../habits/HabitActions';
import { LimitSheet } from '../LimitSheet';
import { SilatPeople } from '../people/SilatPeople';
import { PracticeLoading } from '../PracticeLoading';
import { usePlanWords } from '../plan-words';
import { TimeField } from '../TimeField';

/**
 * «عاداتي › الأعمال الدورية» (round 6 §6, C-10 / C-17 / C-24 a / C-25; reference layout with our visuals): EVERY periodic
 * act in one place. «صلة الرحم والأحباب» is always first, with the people lists inside it (the old «أهلي وناسي»). Then
 * the member's other acts (practice-core `PERIODIC_ACTS` order, then his own), each row with its next date, an «تعديل»
 * link and a visible trash icon (asks first). ONE «أضف عملًا دوريًا» on the title row opens the eight acts and «عمل من
 * اختيارك» (a name, a rhythm and a reminder time). Reminders only: no commitment tracking, outside the habit limit.
 */
export function PeriodicView() {
  const context = useWirdContext();
  if (!context) return <PracticeLoading />;
  return <PeriodicBody context={context} />;
}

function PeriodicBody({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.periodic');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { snapshot, today, habits, planDays } = context;
  const { store } = snapshot;
  const [adding, setAdding] = useState(false);
  const [limitOpen, setLimitOpen] = useState<LimitKind | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const planLimits = useMemo(() => limits(store, today, limitOptions(habits)), [store, today, habits]);
  const acts = useMemo(() => activePeriodicActs(store), [store]);
  const nextOf = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const act of periodicActsOnly(store, today, planDays, habits)) if (act.kind === 'habit') map.set(act.id, act.next);
    return map;
  }, [store, today, planDays, habits]);
  const silat = acts.find((a) => a.key === 'silat');
  const others = acts.filter((a) => a.key !== 'silat').flatMap((a) => a.plans.map((plan) => ({ act: a, plan })));
  const silatInfo = PERIODIC_ACTS[0];

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <TitleRow
        action={
          <Button icon={<Plus aria-hidden />} onClick={() => setAdding(true)}>
            {t('addAct')}
          </Button>
        }
      >
        <h2 className="text-2xl font-medium">{t('title')}</h2>
        <p className="text-sm leading-7 text-muted-foreground">{t('lead')}</p>
      </TitleRow>

      <section aria-labelledby="act-silat" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary-text">
            <HeartHandshake className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h3 id="act-silat" className="text-xl font-medium">
              {locale === 'en' ? silatInfo.en : silatInfo.ar}
            </h3>
            <p className="text-sm leading-7 text-muted-foreground">
              {silat && silat.relatives.length > 0 ? t('silatCount', { n: formatDigits(silat.relatives.length) }) : t('silatLead')}
            </p>
          </div>
        </div>
        {silat && silat.plans.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {silat.plans.map((plan) => (
              <ActRow key={plan.id} plan={plan} next={nextOf.get(plan.id) ?? null} context={context} onDelete={() => setDeleting(plan)} />
            ))}
          </ul>
        ) : null}
        <SilatPeople context={context} />
      </section>

      <SectionDivider />

      <section aria-labelledby="acts-mine" className="flex flex-col gap-3">
        <h3 id="acts-mine" className="text-xl font-medium">
          {t('mineTitle')}
        </h3>
        {others.length === 0 ? (
          <p className="text-sm leading-7 text-muted-foreground">{t('mineEmpty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {others.map(({ plan }) => (
              <ActRow key={plan.id} plan={plan} next={nextOf.get(plan.id) ?? null} context={context} onDelete={() => setDeleting(plan)} />
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          {t('count', { n: formatDigits(planLimits.periodic.count), max: formatDigits(planLimits.periodic.max) })}
        </p>
      </section>

      <AddActDialog
        open={adding}
        onOpenChange={setAdding}
        context={context}
        canAdd={() => planLimits.canAdd('periodic')}
        onLimit={() => {
          setAdding(false);
          setLimitOpen('periodic');
        }}
      />
      <DeleteDialog plan={deleting} habits={habits} onOpenChange={(o) => (o ? undefined : setDeleting(null))} />
      <LimitSheet
        kind={limitOpen ?? 'periodic'}
        open={limitOpen !== null}
        onOpenChange={(open) => (open ? undefined : setLimitOpen(null))}
        limits={planLimits}
        store={store}
        habits={habits}
        today={today}
      />
    </div>
  );
}

/** One act: its next date large (reference), its name and rhythm, «تعديل» (the habit page) and a trash icon. */
function ActRow({ plan, next, context, onDelete }: { plan: Plan; next: string | null; context: WirdContext; onDelete: () => void }) {
  const t = useTranslations('practice.periodic');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { today, habits } = context;
  const words = usePlanWords(plan, habitOf(plan, habits));
  const when =
    next === null ? t('none') : next < today ? t('overdue') : next === today ? t('today') : next === addDays(today, 1) ? t('tomorrow') : formatGregorian(next, locale, true);
  const month = next
    ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { month: 'long', timeZone: 'UTC' }).format(
        new Date(Date.UTC(parseDate(next).year, parseDate(next).month - 1, 15)),
      )
    : null;
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex w-14 shrink-0 flex-col items-center leading-none" aria-hidden>
        <span className="text-3xl font-medium tabular-nums">{next ? formatDigits(parseDate(next).day) : '–'}</span>
        {month ? <span className="mt-1 text-xs text-muted-foreground">{month}</span> : null}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg leading-7 font-medium break-words" lang={words.titleLang}>
          {words.title}
        </span>
        <span className="text-sm leading-6 text-muted-foreground">{when}</span>
      </div>
      <Link href={`/practice/habits/${plan.id}`} className="text-link inline-flex min-h-11 items-center px-2 text-sm">
        {t('edit')}
      </Link>
      <Button variant="ghost" tone="destructive" size="sm" iconOnly icon={<Trash2 aria-hidden />} aria-label={t('deleteNamed', { title: words.title })} onClick={onDelete} />
    </li>
  );
}

type Rhythm = 'weekly' | 'monthly';

/** «أضف عملًا دوريًا»: the catalog acts (after «صلة الرحم والأحباب», which is always there), then «عمل من اختيارك». */
function AddActDialog({
  open,
  onOpenChange,
  context,
  canAdd,
  onLimit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: WirdContext;
  canAdd: () => boolean;
  onLimit: () => void;
}) {
  const t = useTranslations('practice.periodic');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const [custom, setCustom] = useState(false);
  const { snapshot, today, catalog } = context;
  const added = new Set(snapshot.store.plans.map((p) => p.habitKey));
  const byKey = new Map<string, PracticeHabit>((catalog.data?.habits ?? []).map((h) => [h.key, h]));

  function addAct(info: PeriodicActInfo) {
    const habit = info.templates.map((key) => byKey.get(key)).find((h): h is PracticeHabit => h !== undefined && !h.people);
    if (!habit) return;
    if (!canAdd()) {
      onLimit();
      return;
    }
    updateStore((store) => upsertPlan(store, planFromTemplate(habit, today)));
    toast.success(t('addedToast', { title: locale === 'en' ? info.en : info.ar }));
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCustom(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-lg">
        <DialogHeader className="pe-8">
          <DialogTitle className="leading-8">{custom ? t('customTitle') : t('addAct')}</DialogTitle>
          <DialogDescription className="leading-7">{custom ? t('customLead') : t('remindersOnly')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pe-1">
          {custom ? (
            <CustomActForm
              today={today}
              onCancel={() => setCustom(false)}
              onSave={(plan) => {
                if (!canAdd()) {
                  onLimit();
                  return;
                }
                updateStore((store) => upsertPlan(store, plan));
                toast.success(t('addedToast', { title: plan.title }));
                setCustom(false);
                onOpenChange(false);
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {catalog.isError ? <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} className="py-4" /> : null}
              <ul className="flex flex-col divide-y divide-border border-y border-border">
                {PERIODIC_ACTS.filter((a) => !a.circles).map((info) => {
                  const isAdded = info.templates.some((k) => added.has(k));
                  const available = info.templates.some((k) => byKey.has(k));
                  return (
                    <li key={info.key} className="flex min-h-14 items-center justify-between gap-3 py-2">
                      <span className="text-base font-medium">{locale === 'en' ? info.en : info.ar}</span>
                      {isAdded ? (
                        <span className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-3 text-sm font-medium text-primary-text">
                          <Check aria-hidden className="size-4" />
                          {t('added')}
                        </span>
                      ) : (
                        <Button variant="outline" tone="primary" size="sm" icon={<Plus aria-hidden />} disabled={!available} onClick={() => addAct(info)}>
                          {t('addOne')}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Button variant="outline" tone="primary" className="self-start" icon={<Plus aria-hidden />} onClick={() => setCustom(true)}>
                {t('customOpen')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** «عمل من اختيارك»: a name, a rhythm (some weekdays, or a day of each month) and a reminder time. */
function CustomActForm({ today, onSave, onCancel }: { today: string; onSave: (plan: Plan) => void; onCancel: () => void }) {
  const t = useTranslations('practice.periodic');
  const tSetup = useTranslations('practice.setup');
  const [title, setTitle] = useState('');
  const [rhythm, setRhythm] = useState<Rhythm>('weekly');
  const [days, setDays] = useState<number[]>([5]);
  const [monthDay, setMonthDay] = useState('1');
  const [time, setTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const dayId = useId();
  const timeId = useId();
  const rhythmName = useId();

  function save() {
    const day = Number(monthDay);
    if (!title.trim()) return setError(t('errors.title'));
    if (rhythm === 'weekly' && (days.length === 0 || days.length === 7)) return setError(t('errors.days'));
    if (rhythm === 'monthly' && !(Number.isInteger(day) && day >= 1 && day <= 28)) return setError(t('errors.monthDay'));
    const rule: Rule = rhythm === 'weekly' ? { kind: 'weekdays', days: [...days].sort() } : { kind: 'monthlyDay', day };
    try {
      onSave(createCustomPeriodic({ id: newUuid(), title, rule, slots: [time], createdOn: today }));
    } catch {
      setError(t('errors.generic'));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor={titleId} className="text-sm font-medium">
          {t('customName')}
        </label>
        <Input id={titleId} value={title} maxLength={200} placeholder={t('customNameHint')} className="h-11" onChange={(e) => setTitle(e.target.value)} />
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">{t('rhythm')}</legend>
        {(['weekly', 'monthly'] as const).map((r) => (
          <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted">
            <input type="radio" name={rhythmName} className="size-4 accent-primary" checked={rhythm === r} onChange={() => setRhythm(r)} />
            {t(`rhythms.${r}`)}
          </label>
        ))}
      </fieldset>
      {rhythm === 'weekly' ? (
        <DayChips value={days} onChange={setDays} legend={tSetup('days')} />
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={dayId} className="text-sm">
            {t('monthDay')}
          </label>
          <Input id={dayId} type="number" inputMode="numeric" min={1} max={28} className="h-11 w-32" value={monthDay} onChange={(e) => setMonthDay(e.target.value)} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={timeId} className="text-sm">
          {t('reminderTime')}
        </label>
        <TimeField id={timeId} label={t('reminderTime')} value={time} onChange={setTime} className="self-start" />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ActionPair>
        <Button onClick={save}>{t('customSave')}</Button>
        <Button variant="outline" tone="neutral" onClick={onCancel}>
          {t('back')}
        </Button>
      </ActionPair>
    </div>
  );
}
