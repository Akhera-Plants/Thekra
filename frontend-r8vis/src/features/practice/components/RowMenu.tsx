'use client';

import { useState } from 'react';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/shared/kit/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RowMenuProps {
  /** The bordered trigger's accessible name («خيارات: <item>»). */
  label: string;
  edit?: { label: string; onSelect: () => void };
  remove: { label: string; confirmTitle: string; note?: string; confirm: string; keep: string; onConfirm: () => void };
  /**
   * The rows of «الأعمال الدورية» (owner round 6, C-24 a): no «⋯» — «تعديل» as a link and a visible trash icon
   * (named by `label`), the deletion still behind its confirmation.
   */
  inline?: boolean;
}

/**
 * A list row's less frequent actions (owner round 4: destructive actions live in an overflow with a confirmation, never
 * as a link under each item): one bordered «⋯» button, «تعديل», then «احذف» behind a confirmation dialog.
 */
export function RowMenu({ label, edit, remove, inline = false }: RowMenuProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      {inline ? (
        <span className="flex items-center gap-1">
          {edit ? (
            <button type="button" className="text-link inline-flex min-h-11 items-center px-2 text-sm" onClick={edit.onSelect}>
              {edit.label}
            </button>
          ) : null}
          <Button variant="ghost" tone="destructive" size="sm" iconOnly icon={<Trash2 aria-hidden />} aria-label={label} onClick={() => setConfirming(true)} />
        </span>
      ) : (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" tone="neutral" size="sm" iconOnly icon={<Ellipsis aria-hidden />} aria-label={label} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-48 p-1.5">
          {edit ? (
            <>
              <DropdownMenuItem className="min-h-10 px-2" onSelect={edit.onSelect}>
                <Pencil aria-hidden />
                {edit.label}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem variant="destructive" className="min-h-10 px-2" onSelect={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            {remove.label}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      )}
      {/* Our one confirmation (owner round 7, R7-A2), the same as the app's. */}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={remove.confirmTitle}
        description={remove.note}
        confirmLabel={remove.confirm}
        cancelLabel={remove.keep}
        tone="destructive"
        icon={Trash2}
        onConfirm={() => remove.onConfirm()}
      />
    </>
  );
}
