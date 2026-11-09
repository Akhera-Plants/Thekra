'use client';

import { useId, useState } from 'react';
import { Minus, Pencil, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  FARD_LABELS,
  FARD_PRAYERS,
  logQada,
  QADA_KEYS,
  QADA_OWED_MAX,
  QADA_PER_DAY_MAX,
  qadaCountOn,
  qadaProgress,
  setQadaPlan,
  validateQadaPlan,
  type QadaKey,
  type QadaPlan,
  type Store,
} from '@thekra/practice-core';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Button } from '@/components/shared/kit/button';
import { TitleRow } from '@/components/shared/kit/title-row';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { updateStore } from '@/lib/practice/local-store';
import { cn } from '@/lib/utils';

/**
 * «قضاء الفوائت» (round 6 §5, C-01a): inside «الفرائض». A member who owes prayers enters how many (per prayer, or one
 * total), picks a pace (prayers a day) and logs what he makes up; a circular chart shows how much is done. Synced with
 * the account (practice-core `qada.ts`). Kind wording only: what is done and what is left, never a count of failures.
 */
export function QadaSection({ store, today }: { store: Store; today: string }) {
  const t = useTranslations('practice.qada');
  const lang = useLocale() === 'en' ? 'en' : 'ar';
  const [editing, setEditing] = useState(false);
  const progress = qadaProgress(store, today);
  const plan = store.settings.qada;
  const headingId = useId();

  if (!progress || !plan) {
    return (
      <section aria-labelledby={headingId} className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border p-4">
        <h3 id={headingId} className="text-base font-medium">
          {t('title')}
        </h3>
        <p className="text-sm leading-7 text-muted-foreground">{t('emptyLead')}</p>
        <Button variant="outline" tone="primary" size="sm" icon={<Plus aria-hidden />} onClick={() => setEditing(true)}>
          {t('start')}
        </Button>
        <QadaDialog open={editing} onOpenChange={setEditing} plan={null} store={store} today={today} />
      </section>
    );
  }

  const perPrayer = FARD_PRAYERS.filter((p) => plan.owed[p] > 0);
  const keys: QadaKey[] = perPrayer.length > 0 ? [...perPrayer, ...(plan.owed.any > 0 ? (['any'] as const) : [])] : ['any'];
  const done = progress.remaining === 0;

  function log(key: QadaKey, add: number) {
    updateStore((s) => logQada(s, { date: today, prayer: key, add, today }));
    if (add > 0) toast.success(t('logged'));
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <TitleRow
        action={
          <Button variant="ghost" tone="primary" size="sm" icon={<Pencil aria-hidden />} onClick={() => setEditing(true)}>
            {t('edit')}
          </Button>
        }
      >
        <h3 id={headingId} className="text-lg font-medium">
          {t('title')}
        </h3>
      </TitleRow>
      <div className="flex flex-wrap items-center gap-5">
        <QadaRing percent={progress.percent} label={t('ringLabel', { done: formatDigits(progress.doneTotal), total: formatDigits(progress.owedTotal) })} />
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm leading-7">
          <p className="text-base font-medium">{t('doneOf', { done: formatDigits(progress.doneTotal), total: formatDigits(progress.owedTotal) })}</p>
          {done ? (
            <p className="text-primary-text">{t('finished')}</p>
          ) : (
            <>
              <p className="text-muted-foreground">{t('remaining', { n: formatDigits(progress.remaining) })}</p>
              <p className="text-muted-foreground">
                {t('pace', { n: formatDigits(progress.perDay) })}
                {progress.finishOn ? ` · ${t('finishOn', { date: formatGregorian(progress.finishOn, lang) })}` : null}
              </p>
              <p>{t('today', { n: formatDigits(progress.today), of: formatDigits(progress.perDay) })}</p>
            </>
          )}
        </div>
      </div>
      {done ? null : (
        <ul className="flex flex-wrap gap-2" aria-label={t('logLabel')}>
          {keys.map((key) => {
            const left = key === 'any' ? progress.remaining : progress.perKey[key].owed - progress.perKey[key].done;
            const todayCount = qadaCountOn(store, today, key);
            const name = key === 'any' ? t('anyPrayer') : FARD_LABELS[lang].prayers[key];
            return (
              <li key={key} className="flex items-center gap-1 rounded-2xl border border-border bg-card ps-3">
                <span className="text-sm">
                  {name}
                  {todayCount > 0 ? <span className="text-muted-foreground"> · {formatDigits(todayCount)}</span> : null}
                </span>
                {todayCount > 0 ? (
                  <Button variant="ghost" tone="neutral" size="sm" iconOnly icon={<Minus aria-hidden />} aria-label={t('undoOne', { prayer: name })} onClick={() => log(key, -1)} />
                ) : null}
                <Button
                  variant="ghost"
                  tone="primary"
                  size="sm"
                  iconOnly
                  disabled={left <= 0}
                  icon={<Plus aria-hidden />}
                  aria-label={t('logOne', { prayer: name })}
                  onClick={() => log(key, 1)}
                />
              </li>
            );
          })}
        </ul>
      )}
      <QadaDialog open={editing} onOpenChange={setEditing} plan={plan} store={store} today={today} />
    </section>
  );
}

const SIZE = 112;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The circular chart: the done share filled in the primary colour on the track; the percent in the middle (Western digits). */
export function QadaRing({ percent, label, className }: { percent: number; label: string; className?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className={cn('relative flex size-28 shrink-0 items-center justify-center', className)} role="img" aria-label={label}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-muted" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          className={cn('stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500', clamped === 0 && 'stroke-transparent')}
        />
      </svg>
      <span aria-hidden className="relative text-2xl font-medium tabular-nums">
        {formatDigits(clamped)}%
      </span>
    </div>
  );
}

type Mode = 'perPrayer' | 'total';

/** Start or change the plan: per prayer or one total, and the pace. «احذف الخطة» keeps the logs (practice-core). */
function QadaDialog({ open, onOpenChange, plan, store, today }: { open: boolean; onOpenChange: (open: boolean) => void; plan: QadaPlan | null; store: Store; today: string }) {
  const t = useTranslations('practice.qada');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-lg">
        <DialogHeader className="pe-8">
          <DialogTitle className="leading-8">{plan ? t('editTitle') : t('startTitle')}</DialogTitle>
          <DialogDescription className="leading-7">{t('formLead')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pe-1">
          {open ? <QadaForm plan={plan} store={store} today={today} onDone={() => onOpenChange(false)} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QadaForm({ plan, today, onDone }: { plan: QadaPlan | null; store: Store; today: string; onDone: () => void }) {
  const t = useTranslations('practice.qada');
  const lang = useLocale() === 'en' ? 'en' : 'ar';
  const startMode: Mode = plan && FARD_PRAYERS.some((p) => plan.owed[p] > 0) ? 'perPrayer' : 'total';
  const [mode, setMode] = useState<Mode>(startMode);
  const [owed, setOwed] = useState<Record<QadaKey, string>>(() =>
    Object.fromEntries(QADA_KEYS.map((k) => [k, plan && plan.owed[k] > 0 ? String(plan.owed[k]) : ''])) as Record<QadaKey, string>,
  );
  const [perDay, setPerDay] = useState(String(plan?.perDay ?? 5));
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const modeName = useId();
  const num = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : 0);

  function save() {
    const next: QadaPlan = {
      owed: Object.fromEntries(
        QADA_KEYS.map((k) => [k, mode === 'total' ? (k === 'any' ? num(owed.any) : 0) : k === 'any' ? 0 : num(owed[k])]),
      ) as Record<QadaKey, number>,
      perDay: num(perDay),
      startedOn: plan?.startedOn ?? today,
    };
    if (validateQadaPlan(next) !== null) {
      setError(t('formError', { max: formatDigits(QADA_OWED_MAX), perDayMax: formatDigits(QADA_PER_DAY_MAX) }));
      return;
    }
    updateStore((s) => setQadaPlan(s, next));
    toast.success(plan ? t('savedEdit') : t('saved'));
    onDone();
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">{t('modeLegend')}</legend>
        {(['perPrayer', 'total'] as const).map((m) => (
          <label key={m} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted">
            <input type="radio" name={modeName} className="size-4 accent-primary" checked={mode === m} onChange={() => setMode(m)} />
            {t(`mode.${m}`)}
          </label>
        ))}
      </fieldset>
      {mode === 'perPrayer' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FARD_PRAYERS.map((p) => (
            <NumberField key={p} label={FARD_LABELS[lang].prayers[p]} value={owed[p]} onChange={(v) => setOwed((o) => ({ ...o, [p]: v }))} max={QADA_OWED_MAX} />
          ))}
        </div>
      ) : (
        <NumberField label={t('totalLabel')} value={owed.any} onChange={(v) => setOwed((o) => ({ ...o, any: v }))} max={QADA_OWED_MAX} />
      )}
      <NumberField label={t('perDayLabel')} hint={t('perDayHint')} value={perDay} onChange={setPerDay} max={QADA_PER_DAY_MAX} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ActionPair>
        <Button onClick={save}>{t('save')}</Button>
        <Button variant="outline" tone="neutral" onClick={onDone}>
          {t('cancel')}
        </Button>
      </ActionPair>
      {plan ? (
        confirming ? (
          <div role="alert" className="flex flex-col gap-2 rounded-xl border border-destructive/40 p-3">
            <p className="text-sm leading-7">{t('removeConfirmLead')}</p>
            <ActionPair>
              <Button
                tone="destructive"
                onClick={() => {
                  updateStore((s) => setQadaPlan(s, null));
                  toast.success(t('removed'));
                  onDone();
                }}
              >
                {t('removeConfirm')}
              </Button>
              <Button variant="outline" tone="neutral" onClick={() => setConfirming(false)}>
                {t('keep')}
              </Button>
            </ActionPair>
          </div>
        ) : (
          <Button variant="ghost" tone="destructive" size="sm" className="self-start" onClick={() => setConfirming(true)}>
            {t('remove')}
          </Button>
        )
      ) : null}
    </div>
  );
}

function NumberField({ label, hint, value, onChange, max }: { label: string; hint?: string; value: string; onChange: (v: string) => void; max: number }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <Input id={id} type="number" inputMode="numeric" min={0} max={max} className="h-11" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs leading-6 text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
