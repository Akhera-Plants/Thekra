'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ThemeToggleLabels {
  toggle: string;
  light: string;
  dark: string;
  system: string;
}

export interface ThemeToggleProps {
  labels: ThemeToggleLabels;
  className?: string;
}

export function ThemeToggle({ labels, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  // Server snapshot is false; client snapshot is true. No effect, no hydration mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        aria-label={labels.toggle}
        disabled
      >
        <Sun className="size-4" aria-hidden />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={className}
          aria-label={labels.toggle}
        >
          <Sun
            className="size-4 scale-100 rotate-0 transition-[opacity,transform] duration-150 ease-out dark:scale-0 dark:-rotate-90"
            aria-hidden
          />
          <Moon
            className="absolute size-4 scale-0 rotate-90 transition-[opacity,transform] duration-150 ease-out dark:scale-100 dark:rotate-0"
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme ?? 'system'}
          onValueChange={setTheme}
        >
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" aria-hidden />
            {labels.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" aria-hidden />
            {labels.dark}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" aria-hidden />
            {labels.system}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
