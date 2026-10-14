'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ArabicText } from '@/components/shared/ArabicText';
import { reminderWord } from '@/lib/day';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 150;

export const TOPIC_DOMAINS = [
  { key: 'iman', ar: 'الإيمان والعقيدة' },
  { key: 'qalb', ar: 'أعمال القلوب' },
  { key: 'ibadat', ar: 'العبادات' },
  { key: 'lisan', ar: 'اللسان والكلام' },
  { key: 'usra', ar: 'الأسرة والأرحام' },
  { key: 'mujtama', ar: 'الناس والمجتمع' },
  { key: 'mal', ar: 'المال والمعاملات' },
  { key: 'shahawat', ar: 'الشهوات والجسد' },
  { key: 'dima', ar: 'الدماء والولايات' },
  { key: 'ilm', ar: 'العلم والدعوة' },
  { key: 'raqami', ar: 'الوقت والحياة الرقمية' },
  { key: 'adab', ar: 'الآداب والسنن اليومية' },
] as const;

export interface TopicEntry {
  href: string;
  nameAr: string;
  quoteCount: number;
  domainKey: string | null;
  taxonomyOrder: number | null;
  kabira: boolean;
  contemporary: boolean;
}

interface TopicCatalogProps {
  entries: TopicEntry[];
  intent: 'sin' | 'good-deed';
  pageTitle: string;
  searchPlaceholder: string;
  searchLabel: string;
  noResults: string;
  kabiraLabel: string;
  contemporaryLabel: string;
}

export function TopicCatalog({
  entries,
  intent,
  pageTitle,
  searchPlaceholder,
  searchLabel,
  noResults,
  kabiraLabel,
  contemporaryLabel,
}: TopicCatalogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const color = intent === 'sin' ? 'decoration-intent-sin' : 'decoration-intent-good-deed';

  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => {
    if (!debounced) return entries;
    return entries.filter((entry) => entry.nameAr.includes(debounced));
  }, [entries, debounced]);

  const groups = TOPIC_DOMAINS.map((domain) => ({
    ...domain,
    entries: filtered
      .filter((entry) => entry.domainKey === domain.key)
      .sort((a, b) => (a.taxonomyOrder ?? 0) - (b.taxonomyOrder ?? 0)),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-12 md:px-8 md:py-16">
      <h1 className="font-arabic-display text-4xl leading-tight lg:text-5xl">{pageTitle}</h1>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchLabel}
        className="min-h-11 w-full border-b border-border bg-transparent font-arabic-ui text-lg outline-none placeholder:text-muted-foreground focus-visible:border-foreground"
      />
      {groups.length === 0 ? <p className="text-muted-foreground">{noResults}</p> : null}
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col">
          <h2 className="font-arabic-display text-2xl">{group.ar}</h2>
          <ul>
            {group.entries.map((entry) => (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  className="flex min-h-16 items-baseline gap-3 border-b border-border py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArabicText as="span" face="display" size="base" className="min-w-0">
                    {entry.nameAr}
                  </ArabicText>
                  {entry.kabira ? (
                    <span className={cn('shrink-0 text-sm underline decoration-2 underline-offset-4', color)}>
                      {kabiraLabel}
                    </span>
                  ) : null}
                  {entry.contemporary ? (
                    <span className="shrink-0 text-sm text-muted-foreground">{contemporaryLabel}</span>
                  ) : null}
                  <span aria-hidden className="mb-1 min-w-4 flex-1 border-b border-dotted border-border" />
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {String(entry.quoteCount).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)] ?? digit)}{' '}
                    {reminderWord(entry.quoteCount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
