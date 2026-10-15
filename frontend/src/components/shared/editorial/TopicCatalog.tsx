'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { reminderWord } from '@/lib/day';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 150;

export const TOPIC_DOMAINS = [
  { key: 'iman', ar: 'الإيمان والعقيدة', en: 'Faith and creed' },
  { key: 'qalb', ar: 'أعمال القلوب', en: 'Deeds of the heart' },
  { key: 'ibadat', ar: 'العبادات', en: 'Acts of worship' },
  { key: 'lisan', ar: 'اللسان والكلام', en: 'Speech and the tongue' },
  { key: 'usra', ar: 'الأسرة والأرحام', en: 'Family and kinship' },
  { key: 'mujtama', ar: 'الناس والمجتمع', en: 'People and society' },
  { key: 'mal', ar: 'المال والمعاملات', en: 'Wealth and dealings' },
  { key: 'shahawat', ar: 'الشهوات والجسد', en: 'Desires and the body' },
  { key: 'dima', ar: 'الدماء والولايات', en: 'Bloodshed and authority' },
  { key: 'ilm', ar: 'العلم والدعوة', en: 'Knowledge and daʿwah' },
  { key: 'raqami', ar: 'الوقت والحياة الرقمية', en: 'Time and digital life' },
  { key: 'adab', ar: 'الآداب والسنن اليومية', en: 'Daily manners and sunan' },
] as const;

export interface TopicEntry {
  href: string;
  nameAr: string;
  name?: string | null;
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
  const locale = useLocale();
  const arabic = locale === 'ar';
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
    const needle = debounced.toLowerCase();
    return entries.filter((entry) =>
      entry.nameAr.includes(debounced)
      || (entry.name?.toLowerCase().includes(needle) ?? false),
    );
  }, [entries, debounced]);

  const groups = TOPIC_DOMAINS.map((domain) => ({
    ...domain,
    entries: filtered
      .filter((entry) => entry.domainKey === domain.key)
      .sort((a, b) => (a.taxonomyOrder ?? 0) - (b.taxonomyOrder ?? 0)),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-12 md:px-8 md:py-16">
      <h1 className={cn('text-4xl leading-tight lg:text-5xl', arabic ? 'font-arabic-display' : 'font-semibold')}>
        {pageTitle}
      </h1>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchLabel}
        className={cn(
          'min-h-11 w-full border-b border-border bg-transparent text-lg outline-none placeholder:text-muted-foreground focus-visible:border-foreground',
          arabic ? 'font-arabic-ui' : undefined,
        )}
      />
      {groups.length === 0 ? <p className="text-muted-foreground">{noResults}</p> : null}
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col">
          <h2 className={cn('text-2xl', arabic ? 'font-arabic-display' : 'font-semibold')}>
            {arabic ? group.ar : group.en}
          </h2>
          <ul>
            {group.entries.map((entry) => {
              const label = arabic ? entry.nameAr : (entry.name || entry.nameAr);
              const labelArabic = /[\u0600-\u06FF]/.test(label);
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    className="flex min-h-16 items-baseline gap-3 border-b border-border py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      dir={labelArabic ? 'rtl' : 'ltr'}
                      lang={labelArabic ? 'ar' : 'en'}
                      className={cn('min-w-0 text-base', labelArabic ? 'font-arabic-display' : 'font-medium')}
                    >
                      {label}
                    </span>
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
                      <FormattedNumber value={entry.quoteCount} />{' '}
                      {reminderWord(entry.quoteCount, locale)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
