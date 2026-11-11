"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, CircleAlertIcon, InfoIcon, Loader2Icon, TriangleAlertIcon, XIcon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Owner round 7 (R7-A3): the toast in our identity — a white card, the mark in a tinted circle, the line at
      // reading size, an outlined action (src/app/overlays.css). Bottom centre on every page, as in the app.
      icons={{
        success: <CheckIcon strokeWidth={2} />,
        info: <InfoIcon strokeWidth={1.8} />,
        warning: <TriangleAlertIcon strokeWidth={1.8} />,
        error: <CircleAlertIcon strokeWidth={1.8} />,
        loading: <Loader2Icon className="animate-spin" strokeWidth={1.8} />,
        close: <XIcon className="size-3.5" strokeWidth={1.8} />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.875rem",
          "--width": "min(380px, calc(100vw - 2rem))",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
