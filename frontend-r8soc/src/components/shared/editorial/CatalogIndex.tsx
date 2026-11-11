'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { ArabicText } from '@/components/shared/ArabicText';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 150;

const LETTERS = ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];

export interface CatalogEntry {
  href: string;
  nameAr: string;
  name: string;
  quoteCount: number;
  /** Book number, when the entry belongs to a numbered source. */
  number?: number | null;
  /** `both` lists the entry in the common section and in the book index. */
  placement: 'common' | 'index' | 'both';
}

interface CatalogIndexProps {
  entries: CatalogEntry[];
  intent: 'sin' | 'good-deed';
  pageTitle: string;
  searchPlaceholder: string;
  searchLabel: string;
  commonHeading: string;
  indexHeading: string;
  indexNote?: string;
  quietLabel: string;
  noResults: string;
  jumpLabel: string;
}

function arabicInitial(name: string): string {
  const stripped = name.replace(/[\u064B-\u065F\u0670\u0640]/g, '').trim();
  const letter = stripped.charAt(0);
  if ('أإآٱ'.includes(letter)) return 'ا';
  if (letter === 'ة') return 'ه';
  if (letter === 'ى') return 'ي';
  return letter;
}

function Highlight({ text, query, intent }: { text: string; query: string; intent: 'sin' | 'good-deed' }) {
  const needle = query.trim();
  const index = needle ? text.indexOf(needle) : -1;
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark
        className={cn(
          'bg-transparent text-inherit underline decoration-2 underline-offset-4',
          intent === 'sin' ? 'decoration-intent-sin' : 'decoration-intent-good-deed',
        )}
      >
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

function IndexRow({
  entry,
  query,
  intent,
  quietLabel,
  large,
}: {
  entry: CatalogEntry;
  query: string;
  intent: 'sin' | 'good-deed';
  quietLabel: string;
  large?: boolean;
}) {
  const quiet = entry.quoteCount === 0;
  const color = intent === 'sin' ? 'text-intent-sin' : 'text-intent-good-deed';

  return (
    <Link
      href={entry.href}
      className={cn(
        'group flex min-h-16 min-w-0 items-baseline gap-3 border-b border-border py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-[transform,background-color] motion-safe:duration-200 motion-safe:hover:translate-x-1 motion-safe:hover:bg-muted/50 motion-safe:rtl:hover:-translate-x-1 motion-reduce:transition-none',
        quiet && 'text-muted-foreground',
      )}
    >
      {entry.number != null && (
        <span className={cn('w-8 shrink-0 font-arabic-display text-xl', color)}>
          <FormattedNumber value={entry.number} />
        </span>
      )}
      <span className="flex min-w-0 max-w-[70%] flex-col">
        <ArabicText
          as="span"
          face="display"
          size={large ? 'lg' : 'base'}
          className={cn(quiet && 'text-muted-foreground')}
        >
          <Highlight text={entry.nameAr} query={query} intent={intent} />
        </ArabicText>
        {quiet && <span className="text-sm text-muted-foreground">{quietLabel}</span>}
      </span>
      <span aria-hidden className="mb-1 min-w-4 flex-1 border-b border-dotted border-border" />
      <span className="shrink-0 text-sm text-muted-foreground">
        <FormattedNumber value={entry.quoteCount} />
      </span>
    </Link>
  );
}

export function CatalogIndex({
  entries,
  intent,
  pageTitle,
  searchPlaceholder,
  searchLabel,
  commonHeading,
  indexHeading,
  indexNote,
  quietLabel,
  noResults,
  jumpLabel,
}: CatalogIndexProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => {
    if (!debounced) return entries;
    return entries.filter(
      (entry) => entry.nameAr.includes(debounced) || entry.name.toLowerCase().includes(debounced.toLowerCase()),
    );
  }, [entries, debounced]);

  const common = filtered
    .filter((entry) => entry.placement !== 'index')
    .sort((a, b) => b.quoteCount - a.quoteCount);
  const index = filtered
    .filter((entry) => entry.placement !== 'common')
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
  const presentLetters = new Set(index.map((entry) => arabicInitial(entry.nameAr)));
  const firstOfLetter = new Map<string, string>();
  for (const entry of index) {
    const letter = arabicInitial(entry.nameAr);
    if (!firstOfLetter.has(letter)) firstOfLetter.set(letter, entry.href);
  }

  function jumpTo(letter: string) {
    document.getElementById(`letter-${letter}`)?.scrollIntoView({ block: 'start' });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex flex-col gap-4">
        <h1 className="font-arabic-display text-4xl leading-tight lg:text-5xl">{pageTitle}</h1>
        <label htmlFor="catalog-search" className="sr-only">
          {searchLabel}
        </label>
        <input
          ref={inputRef}
          id="catalog-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full min-w-0 border-b border-border bg-transparent py-3 font-arabic-display text-2xl text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-foreground md:text-3xl"
        />
      </header>

      {presentLetters.size > 0 && (
        <nav aria-label={jumpLabel} className="flex flex-wrap gap-1 lg:sticky lg:top-16 lg:z-10 lg:bg-background lg:py-2">
          {LETTERS.filter((letter) => presentLetters.has(letter)).map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => jumpTo(letter)}
              className="min-h-11 min-w-8 px-1 font-arabic-display text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {letter}
            </button>
          ))}
        </nav>
      )}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">{noResults}</p>
      ) : (
        <div className="flex flex-col gap-12">
          {common.length > 0 && (
            <section className="flex flex-col">
              <h2 className="mb-2 font-arabic-display text-xl">{commonHeading}</h2>
              <ul>
                {common.map((entry) => (
                  <li key={entry.href}>
                    <IndexRow
                      entry={{ ...entry, number: null }}
                      query={debounced}
                      intent={intent}
                      quietLabel={quietLabel}
                      large
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {index.length > 0 && (
            <section className="flex flex-col">
              <h2 className="font-arabic-display text-xl">{indexHeading}</h2>
              {indexNote && <p className="mb-4 text-sm text-muted-foreground">{indexNote}</p>}
              <ul className="md:columns-2 md:gap-x-12">
                {index.map((entry) => {
                  const letter = arabicInitial(entry.nameAr);
                  return (
                    <li
                      key={`${entry.href}-index`}
                      id={firstOfLetter.get(letter) === entry.href ? `letter-${letter}` : undefined}
                      className="break-inside-avoid"
                    >
                      <IndexRow entry={entry} query={debounced} intent={intent} quietLabel={quietLabel} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
