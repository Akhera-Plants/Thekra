"use client"

import { useTranslations } from "next-intl"

import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-overlay duration-200 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-150",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  // The close button's name in the page language (it read «Close» on Arabic pages); its 36px ring gets a 44px hit area.
  // Owner round 7 (R7-A3): a white card with a hairline and a soft lift, 24px inside, the title in the heading style
  // (DialogTitle), a bordered round close at the inline end, and a short rise-and-fade in and out.
  const t = useTranslations("app")
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 start-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 gap-5 rounded-2xl border border-border bg-popover p-5 text-[0.9375rem] leading-7 text-popover-foreground shadow-[0_24px_56px_-18px_var(--overlay-shadow),0_2px_8px_-4px_var(--overlay-shadow)] outline-none sm:max-w-md sm:p-6 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:duration-150 motion-reduce:data-open:zoom-in-100 motion-reduce:data-open:slide-in-from-bottom-0",
          showCloseButton && "[&>[data-slot=dialog-header]]:pe-11",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="outline"
              className="absolute top-4 end-4 size-9 rounded-full border-border bg-popover text-muted-foreground shadow-none hover:border-control-border hover:bg-muted hover:text-foreground before:absolute before:-inset-1 before:content-[''] sm:top-5 sm:end-5"
              size="icon-sm"
            >
              <XIcon className="size-4" strokeWidth={1.8} />
              <span className="sr-only">{t("close")}</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 text-start", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const t = useTranslations("app")
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // The actions sit on the card itself, side by side at the same size, the solid one first (no grey band).
        // Whatever the DOM order, the outlined/quiet action (cancel, keep) comes after the solid one.
        "flex flex-wrap gap-2 pt-1 *:min-h-11 *:min-w-[8.5rem] *:flex-1 *:data-[variant=outline]:order-last *:data-[variant=ghost]:order-last *:data-[variant=ghost]:border-control-border",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{t("close")}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        // R7-A4: every modal title in the heading style (the UI face, 21px, ink), never small grey text.
        "text-[1.3125rem] leading-[1.55] font-medium tracking-[-0.01em] text-foreground text-balance",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-[0.9375rem] leading-7 text-muted-foreground *:[a]:text-primary-text *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
