'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { SiteIcon } from '@/components/shared/site-icons';
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
      className={cn('icon-button theme-button', className)}
      aria-label={isDark ? labels.light : labels.dark}
      aria-pressed={mounted ? isDark : undefined}
      title={labels.toggle}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <SiteIcon name={isDark ? 'sun' : 'moon'} />
    </button>
  );
}
