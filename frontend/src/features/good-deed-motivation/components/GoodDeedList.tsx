'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/EmptyState';
import { ArabicText } from '@/components/shared/ArabicText';
import { cn } from '@/lib/utils';
import type { GoodDeedDto } from '@/lib/types/api';

const SEARCH_DEBOUNCE_MS = 300;

interface GoodDeedListProps {
  goodDeeds: GoodDeedDto[];
  className?: string;
}

export function GoodDeedList({ goodDeeds, className }: GoodDeedListProps) {
  const t = useTranslations('goodDeeds');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  function handleSearch(value: string) {
    setQuery(value);
    if (timer) clearTimeout(timer);
    setTimer(
      setTimeout(() => setDebouncedQuery(value), SEARCH_DEBOUNCE_MS),
    );
  }

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return goodDeeds;
    const lower = q.toLowerCase();
    return goodDeeds.filter(
      (d) =>
        d.nameAr.includes(q) ||
        d.name.toLowerCase().includes(lower) ||
        (d.descriptionAr?.includes(q)),
    );
  }, [goodDeeds, debouncedQuery]);

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
          {filtered.map((deed) => (
            <li key={deed.id}>
              <Link
                href={`/good-deeds/${deed.slug}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-[opacity] duration-150 ease-out hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
              >
                <ArabicText as="span" size="base">
                  {deed.nameAr}
                </ArabicText>
                {deed.name && (
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {deed.name}
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
