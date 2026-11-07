'use client';

import { useId, type ReactNode } from 'react';
import { Check, NotebookPen, Sparkles, Undo2, Wrench } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  addDays,
  canMakeUp,
  logForDay,
  requiredOn,
  updatePlan,
  type HabitItem,
  type OccasionItem,
  type Plan,
  type ProgramItem,
  type Relative,
  type RelativeItem,
} from '@thekra/practice-core';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { updateStore } from '@/lib/practice/local-store';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { formatDigits } from '@/lib/format/digits';
import { langOf } from '@/lib/practice/kinship';
import { setMomentSource } from '@/lib/practice/local-store';
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

function InlineUndo({ kind, onUndo }: { kind: UndoKind; onUndo: () => void }) {
  const t = useTranslations('practice.today');
  return (
    <p className="flex items-center gap-1 ps-[3.25rem] text-sm text-muted-foreground">
      {kind === 'cleared' ? t('unlogged') : t('logged')}
      <Button variant="ghost" tone="primary" size="sm" onClick={onUndo}>
        <Undo2 aria-hidden />
        {t('undo')}
      </Button>
    </p>
  );
}

function IconLead({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-[1.125rem]',
        'bg-muted text-muted-foreground',
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
  onToggle: () => void;
  onUndo: () => void;
  /** «أقل ما يمكن»: logs the heavy-day minimum (it counts for the streak); absent when nothing is left to add. */
  onMinimum?: () => void;
  /** The day holds the minimum but not the whole amount. */
  minimumMet?: boolean;
  /** Today, when the row is today's: «صلّحها» shows on a habit missed yesterday. */
  today?: string;
}

export function HabitRow({ item, plan, habit, isEnabled, disabledNoteId, undo, onToggle, onUndo, onMinimum, minimumMet = false, today }: HabitRowProps) {
  const t = useTranslations('practice.hub.day');
  const tToday = useTranslations('practice.today');
  const tHeart = useTranslations('practice.heart');
  const words = usePlanWords(plan, habit);
  const detailId = useId();
  const detail = (
    <>
      {item.missedYesterday && item.minimum && item.done === 0 ? (
        <>
          {t('missedYesterday')} · {t('required', { amount: words.amount(item.minimum) })}
        </>
      ) : (
        t('required', { amount: words.amount(item.required) })
      )}
      {minimumMet ? <> · {tHeart('minimumMet')}</> : item.done > 0 ? <> · {tToday('done', { amount: words.amount(item.done) })}</> : null}
    </>
  );
  const secondary = undo ? (
    <InlineUndo kind={undo} onUndo={onUndo} />
  ) : item.missedYesterday && !item.complete && isEnabled && today ? (
    <p className="ps-[3.25rem]">
      <FixHabit plan={plan} today={today} onMinimum={onMinimum} />
    </p>
  ) : onMinimum && isEnabled ? (
    <p className="ps-[3.25rem]">
      <Button variant="outline" tone="primary" size="sm" onClick={onMinimum}>
        {tHeart('minimum')}
      </Button>
    </p>
  ) : null;
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
        <span lang={words.titleLang} dir={words.titleLang ? 'rtl' : undefined}>
          {words.title}
        </span>
      }
      detail={detail}
      detailId={detailId}
      isMuted={item.complete}
      undo={secondary}
    />
  );
}

/**
 * «صلّحها» on a habit missed yesterday (owner round 3: «خربانة؟ صلّحها» lives in each habit's own row): «لا تفوّتها
 * مرتين», log the least amount today, and make up yesterday while its window is open (until noon today).
 */
function FixHabit({ plan, today, onMinimum }: { plan: Plan; today: string; onMinimum?: () => void }) {
  const t = useTranslations('practice.hub.fix');
  const yesterday = addDays(today, -1);
  const canMakeUpYesterday = canMakeUp(yesterday, today) && (plan.log[yesterday] ?? 0) === 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" tone="primary" size="sm">
          <Wrench aria-hidden />
          {t('open')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-3">
        <p className="font-medium">{t('title')}</p>
        <p className="text-sm leading-7 text-muted-foreground">{t('lead')}</p>
        {/* The two ways to fix it, one pair: same size, the main one solid (O-02/W-03). Labels can be long, so each
            takes the full width when they cannot sit side by side. */}
        <ActionPair>
          {onMinimum ? (
            <Button tone="primary" size="md" className="h-auto min-h-11 whitespace-normal py-2" onClick={onMinimum}>
              {t('minimum')}
            </Button>
          ) : null}
          {canMakeUpYesterday ? (
            <Button
              variant={onMinimum ? 'outline' : 'solid'}
              tone="primary"
              size="md"
              className="h-auto min-h-11 whitespace-normal py-2"
              onClick={() =>
                updateStore((s) => updatePlan(s, plan.id, (p) => logForDay(p, yesterday, Math.max(1, requiredOn(p, yesterday)), today)))
              }
            >
              {t('makeUp')}
            </Button>
          ) : null}
        </ActionPair>
      </PopoverContent>
    </Popover>
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

/** Today's sunnah occasion as one compact line above the list: its name, leading to its good deed. */
export function OccasionLine({ item, basis }: OccasionRowProps) {
  const t = useTranslations('practice.hub.day');
  const tCalendar = useTranslations('calendarPage');
  const locale = useLocale();
  return (
    <li className="flex items-center gap-2 text-sm leading-7">
      <Sparkles aria-hidden className="size-4 shrink-0 text-intent-good-deed" />
      <Link href={`/good-deeds/${item.deed}`} className="text-link font-medium">
        {locale === 'en' ? item.titleEn : item.titleAr}
      </Link>
      <span className="text-muted-foreground">· {basis === 'organizational' ? tCalendar('organizational') : t('occasion')}</span>
    </li>
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
        <IconLead>
          <NotebookPen />
        </IconLead>
      }
      href="/practice/leave-sin"
      title={tLeave('genericTitle')}
      detail={item.done ? t('programDone') : isToday ? t('programToday') : t('programOpen')}
      isMuted={item.done}
      undo={
        isToday ? (
          // «لحظة مجاهدة», quiet and generic: it names nothing, and opens the program in focus on this device.
          <Link
            href="/practice/leave-sin/moment"
            className="outline-button ms-[3.25rem] self-start px-3 text-sm"
            onClick={() => setMomentSource(null)}
          >
            {tLeave('moment.open')}
          </Link>
        ) : undefined
      }
    />
  );
}
