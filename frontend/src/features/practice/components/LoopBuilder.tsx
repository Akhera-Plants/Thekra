'use client';

import { useId, useState } from 'react';
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  activeSinLoops,
  MAX_HABIT_LOOPS,
  MAX_LOOP_TEXT,
  MAX_SIN_LOOPS,
  MAX_SIN_LOOP_TEXT,
  type HabitLoop,
  type Plan,
  type SinLoop,
  type SinProgram,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatDigits } from '@/lib/format/digits';
import { updateStore } from '@/lib/practice/local-store';
import {
  HABIT_LOOP_STEPS,
  SIN_LOOP_STEPS,
  canAddHabitLoop,
  canAddSinLoop,
  cleanHabitLoopInput,
  cleanSinLoopInput,
  deleteHabitLoop,
  deleteSinLoop,
  saveHabitLoop,
  saveSinLoop,
  type HabitLoopStep,
} from '@/lib/practice/loops';
import { cn } from '@/lib/utils';

type LoopKind = 'habit' | 'sin';

interface StepperProps<S extends string> {
  kind: LoopKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: readonly S[];
  initial: Record<S, string>;
  maxLength: number;
  /** The step that must be answered before saving (habit: the routine); null: any one answer (sin). */
  required: S | null;
  onSave: (values: Record<S, string>) => void;
}

/**
 * The loop template as a stepper: one question per step (the template's own wording and a short example), «التالي»
 * and «السابق», and «احفظ الحلقة» on the last step. Answers are the member's own words, shown back only to them.
 */
function LoopStepper<S extends string>({ kind, open, onOpenChange, steps, initial, maxLength, required, onSave }: StepperProps<S>) {
  const tCommon = useTranslations('practice.loops');
  const t = tCommon as unknown as (key: string) => string;
  const fieldId = useId();
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<S, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const step = steps[index] as S;
  const last = index === steps.length - 1;

  function reset(nextOpen: boolean) {
    if (!nextOpen) {
      setIndex(0);
      setError(null);
      setValues(initial);
    }
    onOpenChange(nextOpen);
  }

  function save() {
    if (required !== null && !values[required].trim()) {
      setIndex(steps.indexOf(required));
      setError(tCommon('errors.required'));
      return;
    }
    if (required === null && steps.every((s) => !values[s].trim())) {
      setIndex(0);
      setError(tCommon('errors.any'));
      return;
    }
    onSave(values);
    reset(false);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(`${kind}.title`)}</DialogTitle>
          <DialogDescription>{tCommon('stepOf', { step: formatDigits(index + 1), total: formatDigits(steps.length) })}</DialogDescription>
        </DialogHeader>
        <ol className="flex gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <li key={s} className={cn('h-1.5 flex-1 rounded-full', i <= index ? 'bg-primary' : 'bg-border')} />
          ))}
        </ol>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (last) save();
            else {
              setError(null);
              setIndex(index + 1);
            }
          }}
          noValidate
        >
          <div className="flex flex-col gap-2">
            <label htmlFor={`${fieldId}-${step}`} className="text-lg font-medium">
              {t(`${kind}.steps.${step}.question`)}
              {required === step ? null : kind === 'habit' && (step === 'obstacle' || step === 'ifThen') ? (
                <span className="ms-2 text-sm font-normal text-muted-foreground">{tCommon('optional')}</span>
              ) : null}
            </label>
            <p id={`${fieldId}-${step}-hint`} className="text-sm leading-7 text-muted-foreground">
              {t(`${kind}.steps.${step}.example`)}
            </p>
            <Textarea
              id={`${fieldId}-${step}`}
              key={step}
              rows={3}
              maxLength={maxLength}
              autoFocus
              aria-describedby={`${fieldId}-${step}-hint`}
              aria-invalid={error ? true : undefined}
              value={values[step]}
              onChange={(event) => setValues((v) => ({ ...v, [step]: event.target.value }))}
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" tone="primary">
              {last ? tCommon('save') : tCommon('next')}
            </Button>
            {index > 0 ? (
              <Button variant="outline" tone="neutral" onClick={() => setIndex(index - 1)}>
                {tCommon('back')}
              </Button>
            ) : (
              <Button variant="outline" tone="neutral" onClick={() => reset(false)}>
                {tCommon('cancel')}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Editing = { id: string | null; apply?: boolean } | null;

/** One saved loop as a short chain of its answers, with «عدّل» and «احذف». */
function LoopCard<S extends string>({
  kind,
  steps,
  values,
  index,
  onEdit,
  onDelete,
}: {
  kind: LoopKind;
  steps: readonly S[];
  values: Partial<Record<S, string>>;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tCommon = useTranslations('practice.loops');
  const t = tCommon as unknown as (key: string) => string;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{tCommon('loopN', { n: formatDigits(index + 1) })}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {steps
          .filter((s) => values[s])
          .map((s) => (
            <div key={s} className="flex min-w-0 flex-col rounded-lg bg-muted/50 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{t(`${kind}.steps.${s}.label`)}</dt>
              <dd className="text-sm leading-7 break-words whitespace-pre-line">{values[s]}</dd>
            </div>
          ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" tone="primary" size="sm" onClick={onEdit}>
          <Pencil aria-hidden />
          {tCommon('edit')}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" tone="destructive" size="sm">
              <Trash2 aria-hidden />
              {tCommon('delete')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tCommon('deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{tCommon('deleteBody')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>{tCommon('delete')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

const emptyHabit = (): Record<(typeof HABIT_LOOP_STEPS)[number], string> => ({ cue: '', craving: '', routine: '', reward: '', obstacle: '', ifThen: '' });
const habitValues = (loop: HabitLoop) => ({ ...emptyHabit(), ...loop, obstacle: loop.obstacle ?? '', ifThen: loop.ifThen ?? '' });

/**
 * «ابنِ حلقة عادتك الخاصة» for one habit (owner round 3, item 17): its loops (up to 5), each viewable, editable and
 * removable, and the stepper to build another. Saved on the plan (`loops`) and synced with it.
 */
export function HabitLoops({
  plan,
  compact = false,
  apply,
}: {
  plan: Plan;
  compact?: boolean;
  /**
   * «طبّقها على عادة» (C-18 a): one solid action opens the stepper on the habit's first loop (or a new one) with the
   * answers from `draft` (the strategy's question filled by its example; the member reviews before saving).
   */
  apply?: { label: string; draft: (current: Record<HabitLoopStep, string>) => Record<HabitLoopStep, string>; onSaved: () => void };
}) {
  const t = useTranslations('practice.loops');
  const [editing, setEditing] = useState<Editing>(null);
  const loops = plan.loops ?? [];
  const current = editing?.id ? loops.find((l) => l.id === editing.id) : undefined;
  return (
    <section className="flex flex-col gap-3" aria-label={t('habit.title')}>
      {!compact ? <p className="text-sm leading-7 text-muted-foreground">{t('habit.lead')}</p> : null}
      {loops.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {loops.map((loop, i) => (
            <LoopCard
              key={loop.id}
              kind="habit"
              steps={HABIT_LOOP_STEPS}
              values={loop}
              index={i}
              onEdit={() => setEditing({ id: loop.id })}
              onDelete={() => updateStore((s) => deleteHabitLoop(s, plan.id, loop.id))}
            />
          ))}
        </ol>
      ) : null}
      {apply ? (
        <Button tone="primary" className="self-start" onClick={() => setEditing({ id: loops[0]?.id ?? null, apply: true })}>
          {apply.label}
        </Button>
      ) : canAddHabitLoop(plan) ? (
        <button type="button" className="outline-button button-wrap self-start" onClick={() => setEditing({ id: null })}>
          <Plus aria-hidden />
          {loops.length === 0 ? t('habit.build') : t('habit.another')}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">{t('max', { n: formatDigits(MAX_HABIT_LOOPS) })}</p>
      )}
      <LoopStepper
        key={`${editing?.id ?? 'new'}${editing?.apply ? '-apply' : ''}`}
        kind="habit"
        open={editing !== null}
        onOpenChange={(open) => (open ? undefined : setEditing(null))}
        steps={HABIT_LOOP_STEPS}
        initial={editing?.apply && apply ? apply.draft(current ? habitValues(current) : emptyHabit()) : current ? habitValues(current) : emptyHabit()}
        maxLength={MAX_LOOP_TEXT}
        required="routine"
        onSave={(values) => {
          updateStore((s) => saveHabitLoop(s, plan.id, editing?.id ?? null, cleanHabitLoopInput(values)));
          if (editing?.apply) apply?.onSaved();
        }}
      />
    </section>
  );
}

/** A small button for a habit card: «حلقة العادة» with how many loops it has. */
export function HabitLoopsToggle({ plan, open, onToggle, controls }: { plan: Plan; open: boolean; onToggle: () => void; controls: string }) {
  const t = useTranslations('practice.loops');
  const n = plan.loops?.length ?? 0;
  return (
    <button type="button" className="outline-button" aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      <Repeat aria-hidden />
      {n > 0 ? t('habit.toggleCount', { n: formatDigits(n) }) : t('habit.toggle')}
    </button>
  );
}

const emptySin = (): Record<(typeof SIN_LOOP_STEPS)[number], string> => ({ trigger: '', feeling: '', craving: '', act: '', after: '', alternative: '' });

/**
 * «حلقة المعصية» inside one «تخفَّف» program: the same stepper with the sin template. Stored in the program, so it
 * leaves this browser only inside the encrypted vault.
 */
export function SinLoops({ program, single = false, hideLead = false }: { program: SinProgram; single?: boolean; hideLead?: boolean }) {
  const t = useTranslations('practice.loops');
  const [editing, setEditing] = useState<Editing>(null);
  const loops = activeSinLoops(program);
  const current: SinLoop | undefined = editing?.id ? loops.find((l) => l.id === editing.id) : undefined;
  // `single` (round 5, F-11 a: «حلقة المعصية» is the first week's task, filled once): one loop, edited in place.
  const canAdd = single ? loops.length === 0 : canAddSinLoop(program);
  return (
    <section className="flex flex-col gap-3" aria-label={t('sin.title')}>
      {hideLead ? null : <p className="text-sm leading-7 text-muted-foreground">{t('sin.lead')}</p>}
      {loops.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {loops.map((loop, i) => (
            <LoopCard
              key={loop.id}
              kind="sin"
              steps={SIN_LOOP_STEPS}
              values={loop}
              index={i}
              onEdit={() => setEditing({ id: loop.id })}
              onDelete={() => updateStore((s) => deleteSinLoop(s, program.sinSlug, loop.id))}
            />
          ))}
        </ol>
      ) : null}
      {canAdd ? (
        <button type="button" className="outline-button button-wrap self-start" onClick={() => setEditing({ id: null })}>
          <Plus aria-hidden />
          {loops.length === 0 ? t('sin.build') : t('sin.another')}
        </button>
      ) : single ? null : (
        <p className="text-sm text-muted-foreground">{t('max', { n: formatDigits(MAX_SIN_LOOPS) })}</p>
      )}
      <LoopStepper
        key={editing?.id ?? 'new'}
        kind="sin"
        open={editing !== null}
        onOpenChange={(open) => (open ? undefined : setEditing(null))}
        steps={SIN_LOOP_STEPS}
        initial={current ? { ...emptySin(), ...current } : emptySin()}
        maxLength={MAX_SIN_LOOP_TEXT}
        required={null}
        onSave={(values) => updateStore((s) => saveSinLoop(s, program.sinSlug, editing?.id ?? null, cleanSinLoopInput(values)))}
      />
    </section>
  );
}
