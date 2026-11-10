"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, type LucideIcon } from "lucide-react"

import { cn } from "cn"
import { ActionPair } from "@/components/shared/kit/action-pair"
import { Button } from "@/components/shared/kit/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * The site's one confirmation (owner round 7, R7-A2: «لا تستخدم كومبوننتس نيتف … مودال صغير للكونفرميشن خليه ضمن
 * ثيمنا»). Never `window.confirm`: a small modal in our identity — the mark in a soft circle, the title in the heading
 * face, one line of context, then the two actions side by side at the same size (the solid one first, «إلغاء»
 * outlined). The app has the same component (mobile/src/ui/ConfirmDialog.tsx).
 *
 * Controlled: `<ConfirmDialog open … onConfirm={…} />`. Imperative: `const { confirm, dialog } = useConfirm()`, render
 * `{dialog}` once, then `if (await confirm({ title, confirmLabel, tone: 'destructive' })) …`.
 */
export interface ConfirmOptions {
  title: React.ReactNode
  description?: React.ReactNode
  /** The solid action's label: say what happens («احذفها», «غيّر الرمز»), never «نعم/موافق». */
  confirmLabel: string
  /** Defaults to «إلغاء». */
  cancelLabel?: string
  /** `destructive` for deleting/clearing/signing out of data; `primary` (default) otherwise. */
  tone?: "primary" | "destructive"
  /** The mark in the circle; a warning triangle for `destructive` when omitted. */
  icon?: LucideIcon | null
  /** The solid action's leading icon. */
  confirmIcon?: React.ReactNode
}

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** May return a promise: the button shows it is working and the dialog closes when it settles. */
  onConfirm: () => void | Promise<unknown>
  /** Extra content between the text and the actions (a field, a short list). */
  children?: React.ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  icon,
  confirmIcon,
  children,
}: ConfirmDialogProps) {
  const t = useTranslations("app")
  const [busy, setBusy] = React.useState(false)
  const Mark = icon === undefined ? (tone === "destructive" ? AlertTriangle : null) : icon

  const handleConfirm = async () => {
    try {
      setBusy(true)
      await onConfirm()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <AlertDialogContent size="sm" data-tone={tone}>
        <AlertDialogHeader>
          {Mark ? (
            <AlertDialogMedia
              className={cn(
                tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary-text"
              )}
            >
              <Mark aria-hidden strokeWidth={1.6} />
            </AlertDialogMedia>
          ) : null}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <ActionPair>
            <Button
              tone={tone}
              icon={confirmIcon}
              loading={busy}
              onClick={() => void handleConfirm()}
            >
              {confirmLabel}
            </Button>
            <Button variant="outline" tone="neutral" disabled={busy} onClick={() => onOpenChange(false)}>
              {cancelLabel ?? t("cancel")}
            </Button>
          </ActionPair>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** The promise form: `if (await confirm({...}))`. Render `dialog` once in the component. */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  dialog: React.ReactNode
} {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const [open, setOpen] = React.useState(false)

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...options, resolve })
        setOpen(true)
      }),
    []
  )

  const dialog = state ? (
    <ConfirmDialog
      {...state}
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false)
          state.resolve(false)
        }
      }}
      onConfirm={() => {
        state.resolve(true)
      }}
    />
  ) : null

  return { confirm, dialog }
}
