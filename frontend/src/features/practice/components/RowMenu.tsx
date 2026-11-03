'use client';

import { useState } from 'react';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/shared/kit/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
}

/**
 * A list row's less frequent actions (owner round 4: destructive actions live in an overflow with a confirmation, never
 * as a link under each item): one bordered «⋯» button, «تعديل», then «احذف» behind a confirmation dialog.
 */
export function RowMenu({ label, edit, remove }: RowMenuProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
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
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{remove.confirmTitle}</AlertDialogTitle>
            {remove.note ? <AlertDialogDescription>{remove.note}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" tone="neutral" onClick={() => setConfirming(false)}>
              {remove.keep}
            </Button>
            <Button
              tone="destructive"
              onClick={() => {
                setConfirming(false);
                remove.onConfirm();
              }}
            >
              {remove.confirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
