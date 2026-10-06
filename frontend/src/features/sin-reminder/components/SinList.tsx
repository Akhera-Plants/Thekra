'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/EmptyState';
import { ArabicText } from '@/components/shared/ArabicText';
import { SinRankBadge } from '@/components/shared/SinRankBadge';
import { cn } from '@/lib/utils';
import type { SinDto } from '@/lib/types/api';

const SEARCH_DEBOUNCE_MS = 300;

interface SinListProps {
  sins: SinDto[];
  className?: string;
}

/**
 * Browsable sin catalogue: client-side search filter + list of links.
 * Data is passed from the server (prefetched); no fetching here.
 */
export function SinList({ sins, className }: SinListProps) {
  const t = useTranslations('sins');
  const tRank = useTranslations('sinRank');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search to satisfy INP budget (design-system.mdc §4)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  function handleSearch(value: string) {
    setQuery(value);
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => setDebouncedQuery(value), SEARCH_DEBOUNCE_MS));
  }

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return sins;
    const lower = q.toLowerCase();
    return sins.filter(
      (s) =>
        s.nameAr.includes(q) ||
        s.name.toLowerCase().includes(lower) ||
        (s.descriptionAr?.includes(q)),
    );
  }, [sins, debouncedQuery]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Input
        type="search"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="w-full"
        dir="rtl"
      />
      {filtered.length === 0 ? (
        <EmptyState message={t('noResults')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {filtered.map((sin) => (
            <li key={sin.id}>
              <Link
                href={`/sins/${sin.slug}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-[opacity] duration-150 ease-out hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ArabicText as="span" size="base">
                    {sin.nameAr}
                  </ArabicText>
                  {sin.rank && (
                    <SinRankBadge rank={sin.rank} label={tRank(sin.rank)} />
                  )}
                </span>
                {sin.name && (
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {sin.name}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
