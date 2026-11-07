'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export interface ThemeToggleLabels {
  toggle: string;
  light: string;
  dark: string;
  system?: string;
}

export interface ThemeToggleProps {
  labels: ThemeToggleLabels;
  className?: string;
}

/** Prototype-shaped theme control: icon button flipping light ↔ dark via next-themes. */
export function ThemeToggle({ labels, className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      // touch-44: the phone header draws it 27×34; the hit area is 44×44 without changing the look (W-17).
      className={cn('icon-button theme-button touch-44', className)}
      aria-label={isDark ? labels.light : labels.dark}
      aria-pressed={mounted ? isDark : undefined}
      title={labels.toggle}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-[19px]" aria-hidden /> : <Moon className="size-[19px]" aria-hidden />}
    </button>
  );
}
