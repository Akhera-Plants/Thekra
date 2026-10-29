'use client';

import { useId, type ReactNode } from 'react';
import { Check, HandHeart, NotebookPen, Sparkles, Undo2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { HabitItem, OccasionItem, Plan, ProgramItem, Relative, RelativeItem } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import { formatDigits } from '@/lib/format/digits';
import { langOf } from '@/lib/practice/kinship';
import type { PracticeHabit, ScheduleBasis } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { usePlanWords } from '../PlanCard';

type Href = Parameters<typeof Link>[0]['href'];

interface RowShellProps {
  lead: ReactNode;
  href: Href;
  title: ReactNode;
  detail: ReactNode;
  detailId?: string;
  isMuted?: boolean;
  undo?: ReactNode;
}

/** One line of the day: the control (or icon) at the start, then a link to the item's own page. */
function RowShell({ lead, href, title, detail, detailId, isMuted = false, undo }: RowShellProps) {
  return (
    <li className="flex flex-col py-2">
      <div className="flex items-center gap-2">
        {lead}
        <Link
          href={href}
          className="group flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={cn('text-base leading-7 font-medium break-words', isMuted && 'text-muted-foreground')}>{title}</span>
            <span id={detailId} className="text-sm leading-6 text-muted-foreground">
              {detail}
            </span>
          </span>
          <DirectionalArrow className="size-4 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
        </Link>
      </div>
      {undo}
    </li>
  );
}

interface CheckControlProps {
  label: string;
  state: boolean | 'mixed';
  detailId: string;
  /** False on a future day or a day older than the logging window: the state is shown, not changed. */
  isEnabled: boolean;
  disabledNoteId?: string;
  onToggle: () => void;
}

/** A round checkbox, 44px target: empty, half (some amount logged) or filled with a check. */
function CheckControl({ label, state, detailId, isEnabled, disabledNoteId, onToggle }: CheckControlProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state}
      aria-label={label}
      aria-describedby={[detailId, isEnabled ? null : disabledNoteId].filter(Boolean).join(' ') || undefined}
      aria-disabled={isEnabled ? undefined : true}
      onClick={isEnabled ? onToggle : undefined}
      className={cn(
        'group/check flex size-11 shrink-0 items-center justify-center rounded-full',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        isEnabled ? 'cursor-pointer' : 'cursor-not-allowed',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-7 items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] duration-150 ease-out',
          'group-active/check:scale-90 motion-reduce:group-active/check:scale-100',
          state === true && 'border-primary bg-primary text-primary-foreground',
          state === 'mixed' && 'border-primary bg-[linear-gradient(to_top,var(--primary)_50%,transparent_50%)]',
          state === false &&
            (isEnabled
              ? 'border-primary/60 group-hover/check:border-primary dark:border-ring/70 dark:group-hover/check:border-ring'
              : 'border-border'),
          !isEnabled && state !== false && 'opacity-60',
        )}
      >
        {state === true ? <Check className="size-4" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

/** What the last quick action did to a row: «تراجع» puts back what was there before it. */
export type UndoKind = 'logged' | 'cleared';

/** «سُجِّل · تراجع»; for about 2 s after a habit's tick the catalog's short supplication stands in for «سُجِّل». */
function InlineUndo({ kind, celebration, onUndo }: { kind: UndoKind; celebration?: string; onUndo: () => void }) {
  const t = useTranslations('practice.today');
  return (
    <p className="flex items-center gap-1 ps-[3.25rem] text-sm text-muted-foreground">
      {celebration && kind === 'logged' ? (
        <span className="font-medium text-primary motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          {celebration}
        </span>
      ) : kind === 'cleared' ? (
        t('unlogged')
      ) : (
        t('logged')
      )}
      <Button variant="ghost" tone="primary" size="sm" onClick={onUndo}>
        <Undo2 aria-hidden />
        {t('undo')}
      </Button>
    </p>
  );
}

function IconLead({ children, tone }: { children: ReactNode; tone: 'occasion' | 'program' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-[1.125rem]',
        tone === 'occasion' ? 'bg-intent-good-deed/12 text-intent-good-deed' : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

interface HabitRowProps {
  item: HabitItem;
  plan: Plan;
  habit: PracticeHabit | undefined;
  isEnabled: boolean;
  disabledNoteId: string;
  undo: UndoKind | null;
  /** The habit chosen in «نيّتي اليوم» for this day: a small quiet mark. */
  isIntended?: boolean;
  /** The short supplication after this row's tick, while it shows. */
  celebration?: string;
  onToggle: () => void;
  onUndo: () => void;
}

export function HabitRow({ item, plan, habit, isEnabled, disabledNoteId, undo, isIntended = false, celebration, onToggle, onUndo }: HabitRowProps) {
  const t = useTranslations('practice.hub.day');
  const tToday = useTranslations('practice.today');
  const tTazkiya = useTranslations('tazkiya');
  const words = usePlanWords(plan, habit);
  const detailId = useId();
  const detail = (
    <>
      {t('required', { amount: words.amount(item.required) })}
      {item.done > 0 ? <> · {tToday('done', { amount: words.amount(item.done) })}</> : null}
    </>
  );
  return (
    <RowShell
      lead={
        <CheckControl
          label={words.title}
          state={item.complete ? true : item.done > 0 ? 'mixed' : false}
          detailId={detailId}
          isEnabled={isEnabled}
          disabledNoteId={disabledNoteId}
          onToggle={onToggle}
        />
      }
      href={`/practice/habits#plan-${plan.id}`}
      title={
        <>
          <span lang={words.titleLang} dir={words.titleLang ? 'rtl' : undefined}>
            {words.title}
          </span>
          {isIntended ? (
            <span className="ms-2 inline-flex align-middle text-primary" title={tTazkiya('niyyahMark')}>
              <HandHeart className="size-4" aria-hidden />
              <span className="sr-only">{tTazkiya('niyyahMark')}</span>
            </span>
          ) : null}
        </>
      }
      detail={detail}
      detailId={detailId}
      isMuted={item.complete}
      undo={undo ? <InlineUndo kind={undo} celebration={celebration} onUndo={onUndo} /> : null}
    />
  );
}

interface RelativeRowProps {
  item: RelativeItem;
  relative: Relative;
  isEnabled: boolean;
  disabledNoteId: string;
  undo: UndoKind | null;
  onToggle: () => void;
  onUndo: () => void;
}

export function RelativeRow({ item, relative, isEnabled, disabledNoteId, undo, onToggle, onUndo }: RelativeRowProps) {
  const t = useTranslations('practice.hub.day');
  const detailId = useId();
  const canToggle = isEnabled;
  const detail = item.done
    ? t('relativeDone')
    : item.overdueDays === 0
      ? t('relativeDue')
      : t('relativeOverdue', { count: item.overdueDays, n: formatDigits(item.overdueDays) });
  return (
    <RowShell
      lead={
        <CheckControl
          label={relative.name}
          state={item.done}
          detailId={detailId}
          isEnabled={canToggle}
          disabledNoteId={disabledNoteId}
          onToggle={onToggle}
        />
      }
      href="/practice/kinship"
      title={
        <>
          <bdi lang={langOf(relative.name)}>{relative.name}</bdi>
          {relative.relation ? (
            <span className="text-sm font-normal text-muted-foreground">
              {' · '}
              <bdi lang={langOf(relative.relation)}>{relative.relation}</bdi>
            </span>
          ) : null}
        </>
      }
      detail={detail}
      detailId={detailId}
      isMuted={item.done}
      undo={undo ? <InlineUndo kind={undo} onUndo={onUndo} /> : null}
    />
  );
}

interface OccasionRowProps {
  item: OccasionItem;
  basis: ScheduleBasis | undefined;
}

export function OccasionRow({ item, basis }: OccasionRowProps) {
  const t = useTranslations('practice.hub.day');
  const tCalendar = useTranslations('calendarPage');
  const locale = useLocale();
  return (
    <RowShell
      lead={
        <IconLead tone="occasion">
          <Sparkles />
        </IconLead>
      }
      href={`/good-deeds/${item.deed}`}
      title={locale === 'en' ? item.titleEn : item.titleAr}
      detail={basis === 'organizational' ? tCalendar('organizational') : t('occasion')}
    />
  );
}

interface ProgramRowProps {
  item: ProgramItem;
  isToday: boolean;
}

/** The sin program, generic on purpose: never its name, only whether this day has a check-in (roadmap §0.2). */
export function ProgramRow({ item, isToday }: ProgramRowProps) {
  const t = useTranslations('practice.hub.day');
  const tLeave = useTranslations('leaveSin');
  return (
    <RowShell
      lead={
        <IconLead tone="program">
          <NotebookPen />
        </IconLead>
      }
      href="/practice/leave-sin"
      title={tLeave('genericTitle')}
      detail={item.done ? t('programDone') : isToday ? t('programToday') : t('programOpen')}
      isMuted={item.done}
    />
  );
}
