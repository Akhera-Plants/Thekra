'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
  label: string;
  icon?: React.ElementType;
  onSelect: () => void;
  disabled?: boolean;
  /** Shown instead of running when disabled, e.g. why it can't be deleted. */
  disabledReason?: string;
}

export interface RowActionsProps {
  label: string;
  primary: RowAction[];
  /** One destructive action, always behind a confirmation. */
  destructive?: RowAction & { confirmTitle: string; confirmBody: string; confirmLabel: string; cancelLabel: string };
}

/** Row menu: edit first, the destructive action last, separated and confirmed. */
export function RowActions({ label, primary, destructive }: RowActionsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={label}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            {primary.map(({ label: itemLabel, icon: Icon, onSelect, disabled }) => (
              <DropdownMenuItem key={itemLabel} disabled={disabled} onSelect={onSelect}>
                {Icon ? <Icon aria-hidden /> : null}
                {itemLabel}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          {destructive ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={destructive.disabled}
                  title={destructive.disabled ? destructive.disabledReason : undefined}
                  onSelect={() => setConfirming(true)}
                >
                  {destructive.icon ? <destructive.icon aria-hidden /> : null}
                  {destructive.label}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {destructive ? (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{destructive.confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{destructive.confirmBody}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{destructive.cancelLabel}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={destructive.onSelect}>
                {destructive.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
