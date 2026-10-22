'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * Filters live in the URL so a queue can be linked to («/admin/flags?severity=HIGH»)
 * and survives reloads. `set` merges, drops empty values, and replaces (no history spam).
 */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const values = Object.fromEntries(keys.map((key) => [key, searchParams.get(key)])) as Record<K, string | null>;

  const set = useCallback(
    (patch: Partial<Record<K, string | null>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch) as [K, string | null | undefined][]) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [values, set] as const;
}
