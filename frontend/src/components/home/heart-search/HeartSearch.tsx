'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { getSins } from '@/lib/api/sins';
import type { LocaleCode } from '@/lib/types/enums';

interface Hit {
  href: string;
  nameAr: string;
  name: string;
  kind: string;
}

interface Result {
  needle: string;
  attempt: number;
  hits: Hit[];
  failed: boolean;
}

const DEBOUNCE_MS = 150;

export function HeartSearch() {
  const t = useTranslations('home');
  const locale = useLocale() as LocaleCode;
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loadingNeedle, setLoadingNeedle] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const needle = query.trim();
  const searching = needle.length >= 2;
  const current = result?.needle === needle && result.attempt === attempt ? result : null;
  const hits = current?.hits ?? [];
  const failed = current?.failed ?? false;
  const loading = searching && loadingNeedle === `${needle}:${attempt}` && !current;

  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!searching) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoadingNeedle(`${needle}:${attempt}`);
      Promise.all([
        getSins({ q: needle, limit: 6, lang: locale }),
        getGoodDeeds({ q: needle, limit: 6, lang: locale }),
      ])
        .then(([sins, deeds]) => {
          if (cancelled) return;
          setResult({
            needle,
            attempt,
            failed: false,
            hits: [
              ...sins.data.map((sin) => ({
                href: `/sins/${sin.slug}`,
                nameAr: sin.nameAr,
                name: sin.name,
                kind: t('sinKind'),
              })),
              ...deeds.data.map((deed) => ({
                href: `/good-deeds/${deed.slug}`,
                nameAr: deed.nameAr,
                name: deed.name,
                kind: t('deedKind'),
              })),
            ],
          });
        })
        .catch(() => {
          if (!cancelled) setResult({ needle, attempt, hits: [], failed: true });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searching, needle, locale, t, attempt]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') setQuery('');
    if (event.key === 'ArrowDown') {
      const first = document.getElementById(`${listId}-0`);
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <search className="flex min-w-0 flex-col gap-3">
      <label htmlFor="heart-search" className="sr-only">
        {t('searchLabel')}
      </label>
      <input
        ref={inputRef}
        id="heart-search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={t('searchPlaceholder')}
        aria-controls={hits.length > 0 ? listId : undefined}
        className="w-full min-w-0 border-b border-foreground/30 bg-transparent py-2 font-arabic-ui text-lg text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div aria-live="polite" className="flex flex-col gap-3">
      {loading && <p className="text-sm text-muted-foreground">{t('searching')}</p>}

      {failed && (
        <p className="text-sm text-muted-foreground">
          {t('searchError')}{' '}
          <button
            type="button"
            className="home-press min-h-11 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('retry')}
          </button>
        </p>
      )}

      {current && !failed && hits.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      )}

      {hits.length > 0 && (
        <ul id={listId} aria-label={t('searchLabel')} className="flex flex-col">
          {hits.map((hit, index) => (
            <li key={hit.href}>
              <Link
                id={`${listId}-${index}`}
                href={hit.href}
                className="home-press flex min-h-11 min-w-0 items-baseline justify-between gap-4 rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    document.getElementById(`${listId}-${index + 1}`)?.focus();
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    if (index === 0) inputRef.current?.focus();
                    else document.getElementById(`${listId}-${index - 1}`)?.focus();
                  }
                  if (event.key === 'Escape') inputRef.current?.focus();
                }}
              >
                {locale === 'en' && hit.name ? (
                  <span className="min-w-0 text-lg font-medium">{hit.name}</span>
                ) : (
                  <span dir="rtl" lang="ar" className="min-w-0 font-arabic-text text-lg">
                    {hit.nameAr}
                  </span>
                )}
                <span className="shrink-0 text-sm text-muted-foreground">{hit.kind}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </div>
    </search>
  );
}
