'use client';

import { Check, ChevronDown, Pause, Pencil, PencilLine, Play, Sprout, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PlanAction } from '@/lib/practice/plans';

interface PlanActionButtonProps {
  action: PlanAction;
  /** The habit's title element, so «سجّل» is announced with the habit it logs. */
  describedBy: string;
  onLog: () => void;
  onUnlog: () => void;
  onResume: () => void;
}

/**
 * The trailing action of a habit row: «سجّل» (solid when the habit is asked for today, outlined on other days),
 * «تمّ ✓» once logged (pressed; a second tap takes today's log back, with «تراجع»), «استأنف» while paused.
 */
export function PlanActionButton({ action, describedBy, onLog, onUnlog, onResume }: PlanActionButtonProps) {
  const t = useTranslations('practice.today');
  switch (action) {
    case 'resume':
      return (
        <button type="button" className="outline-button shrink-0" aria-describedby={describedBy} onClick={onResume}>
          <Play aria-hidden />
          {t('resume')}
        </button>
      );
    case 'done':
      return (
        <button
          type="button"
          className="outline-button plan-done shrink-0"
          aria-pressed
          aria-describedby={describedBy}
          title={t('doneUndoHint')}
          onClick={onUnlog}
        >
          <Check aria-hidden />
          {t('doneToday')}
        </button>
      );
    case 'log':
      return (
        <button type="button" className="solid-button shrink-0" aria-describedby={describedBy} onClick={onLog}>
          <Check aria-hidden />
          {t('logAction')}
        </button>
      );
    case 'logQuiet':
      return (
        <button type="button" className="outline-button shrink-0" aria-describedby={describedBy} onClick={onLog}>
          {t('logAction')}
        </button>
      );
  }
}

interface PlanOptionsProps {
  isPaused: boolean;
  deedHref: string | null;
  onEdit: () => void;
  onFixLog: () => void;
  onPause: () => void;
  onRemove: () => void;
}

/** «خيارات»: the habit's less frequent actions in one bordered menu, so the row keeps one clear action. */
export function PlanOptions({ isPaused, deedHref, onEdit, onFixLog, onPause, onRemove }: PlanOptionsProps) {
  const t = useTranslations('practice.today');
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="outline-button">
          {t('options')}
          <ChevronDown aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-56 p-1.5">
        <DropdownMenuItem className="min-h-10 px-2" onSelect={onEdit}>
          <Pencil aria-hidden />
          {t('edit')}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-10 px-2" onSelect={onFixLog}>
          <PencilLine aria-hidden />
          {t('editLog.open')}
        </DropdownMenuItem>
        {!isPaused ? (
          <DropdownMenuItem className="min-h-10 px-2" onSelect={onPause}>
            <Pause aria-hidden />
            {t('pause')}
          </DropdownMenuItem>
        ) : null}
        {deedHref ? (
          <DropdownMenuItem asChild className="min-h-10 px-2">
            <Link href={deedHref}>
              <Sprout aria-hidden />
              {t('readAbout')}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="min-h-10 px-2" onSelect={onRemove}>
          <Trash2 aria-hidden />
          {t('remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
