'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/shared/kit/button';
import { cn } from '@/lib/utils';

export interface ThemeToggleLabels {
  toggle: string;
  light: string;
  dark: string;
  /** Kept for callers; the header control no longer opens a system menu. */
  system?: string;
}

export interface ThemeToggleProps {
  labels: ThemeToggleLabels;
  className?: string;
}

export function ThemeToggle({ labels, className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      tone="neutral"
      size="md"
      iconOnly
      className={cn('relative', className)}
      aria-label={labels.toggle}
      aria-pressed={mounted ? isDark : undefined}
      disabled={!mounted}
      icon={
        <>
          <Sun
            className="size-4 scale-100 rotate-0 transition-[opacity,transform] duration-150 ease-out dark:scale-0 dark:-rotate-90"
            aria-hidden
          />
          <Moon
            className="absolute size-4 scale-0 rotate-90 transition-[opacity,transform] duration-150 ease-out dark:scale-100 dark:rotate-0"
            aria-hidden
          />
        </>
      }
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    />
  );
}
