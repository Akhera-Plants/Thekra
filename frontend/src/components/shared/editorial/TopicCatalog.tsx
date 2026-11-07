'use client';

import { Suspense, useEffect, useMemo, useRef, useState, useTransition, type ComponentType } from 'react';
import { BookOpen, Check, DoorOpen, Search, Sprout } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { LinkPending } from '@/components/shared/feedback/LinkPending';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { formatDigits } from '@/lib/format/digits';
import { domainChips, filterTopics, groupByDomain, OTHER_DOMAIN, type CatalogFilter } from '@/lib/catalog-filter';
import { searchTopicThemes } from '@/lib/search/topic-themes';
import { TOPIC_DOMAINS } from '@/lib/topic-domains';
import type { TopicThemeIndexEntry } from '@/lib/types/api';

const SEARCH_DEBOUNCE_MS = 300;

const INTENT_ICON: Record<'sin' | 'good-deed' | 'branch', ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  sin: DoorOpen,
  'good-deed': Sprout,
  branch: BookOpen,
};

export { TOPIC_DOMAINS };

export interface TopicEntry {
  href: string;
  nameAr: string;
  name?: string | null;
  /** Other names the search also matches (a sin's paired virtue). Not displayed. */
  aliases?: readonly string[];
  quoteCount: number;
  domainKey: string | null;
  taxonomyOrder: number | null;
  kabira: boolean;
  contemporary: boolean;
  /** A good deed with a catalog habit («اجعلها عادتي»): the «لها عادة» switch keeps these. */
  hasHabit?: boolean;
}

interface TopicCatalogProps {
  entries: TopicEntry[];
  intent: 'sin' | 'good-deed' | 'branch';
  pageTitle: string;
  eyebrow: string;
  lead: string;
  pathHref: string;
  pathLabel: string;
  searchPlaceholder: string;
  searchLabel: string;
  noResults: string;
  kabiraLabel?: string;
  contemporaryLabel?: string;
  /** GET /topic-themes: theme labels the search also matches (sins / good-deeds catalogues). */
  themes?: TopicThemeIndexEntry[];
  /** «الكبائر» (sins) or «لها عادة» (good deeds): one switch beside the domain chips, shown when an entry has it. */
  flag?: { kind: 'kabira' | 'habit'; label: string };
}

export function TopicCatalog(props: TopicCatalogProps) {
  return (
    <Suspense fallback={<TopicCatalogShell {...props} query="" />}>
      <TopicCatalogWithSearch {...props} />
    </Suspense>
  );
}

function TopicCatalogWithSearch(props: TopicCatalogProps) {
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') ?? '';
  // Remount when the URL query changes (back/forward) so local state stays in sync
  // without setState-in-effect.
  return <TopicCatalogSearchInner key={qParam} initialQuery={qParam} {...props} />;
}

/** `?domain=` and `?only=1` (the «كبائر» / «لها عادة» switch): read from the URL, written back on each tap. */
function useCatalogParams() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const domain = searchParams.get('domain');
  const only = searchParams.get('only') === '1';
  function set(name: 'domain' | 'only', value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  return {
    domain,
    only,
    setDomain: (key: string | null) => set('domain', key),
    setOnly: (on: boolean) => set('only', on ? '1' : null),
  };
}

function TopicCatalogSearchInner({
  initialQuery,
  ...props
}: TopicCatalogProps & { initialQuery: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery.trim());

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim();
      setDebounced(next);
      if (next === initialQuery.trim()) return;
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set('q', next);
      else params.delete('q');
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, pathname, initialQuery, router, searchParams, startTransition]);

  const params = useCatalogParams();
  return (
    <TopicCatalogShell
      {...props}
      query={query}
      debounced={debounced}
      onQueryChange={setQuery}
      domain={params.domain}
      only={params.only}
      onDomainChange={params.setDomain}
      onOnlyChange={params.setOnly}
    />
  );
}

interface ShellProps extends TopicCatalogProps {
  query: string;
  debounced?: string;
  onQueryChange?: (value: string) => void;
  domain?: string | null;
  only?: boolean;
  onDomainChange?: (key: string | null) => void;
  onOnlyChange?: (on: boolean) => void;
}

function TopicCatalogShell({
  entries,
  intent,
  pageTitle,
  eyebrow,
  lead,
  pathHref: _pathHref,
  pathLabel,
  searchPlaceholder,
  searchLabel,
  noResults,
  kabiraLabel,
  contemporaryLabel,
  themes,
  flag,
  query,
  debounced = '',
  onQueryChange,
  domain = null,
  only = false,
  onDomainChange,
  onOnlyChange,
}: ShellProps) {
  void _pathHref;
  const locale = useLocale();
  const arabic = locale === 'ar';
  const tNav = useTranslations('nav');
  const tCrumbs = useTranslations('breadcrumbs');
  const tCatalog = useTranslations('catalog');
  const inputRef = useRef<HTMLInputElement>(null);
  const prefetchRouter = useRouter();
  /** ~80 cards: prefetching them all in view would pull every topic page; fetch the one the visitor reaches for. */
  const reach = (href: string) => ({
    prefetch: false as const,
    onPointerEnter: () => prefetchRouter.prefetch(href),
    onFocus: () => prefetchRouter.prefetch(href),
  });
  const Icon = INTENT_ICON[intent];

  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) inputRef.current?.focus();
  }, []);

  const hasFlag = Boolean(flag) && entries.some((entry) => (flag?.kind === 'kabira' ? entry.kabira : entry.hasHabit));
  const filter: CatalogFilter = useMemo(
    () => ({
      query: debounced,
      domain,
      kabiraOnly: hasFlag && only && flag?.kind === 'kabira',
      habitOnly: hasFlag && only && flag?.kind === 'habit',
    }),
    [debounced, domain, hasFlag, only, flag?.kind],
  );
  const chips = useMemo(() => domainChips(entries, filter), [entries, filter]);
  const filtered = useMemo(() => filterTopics(entries, filter), [entries, filter]);
  // Grouped under domain headings unless one domain is chosen (the chip names it) or there is no domain data.
  const groups = useMemo(
    () => (chips.length > 0 && !domain ? groupByDomain(filtered) : [{ key: '', entries: filtered }]),
    [chips.length, domain, filtered],
  );
  const domainLabel = (key: string) => {
    const found = TOPIC_DOMAINS.find((item) => item.key === key);
    return found ? (arabic ? found.ar : found.en) : tCatalog('otherDomain');
  };

  // A theme hit opens its page with the chip already on (?theme=).
  const themeHits = useMemo(() => {
    if (!debounced || !themes || intent === 'branch') return [];
    return searchTopicThemes(themes, debounced, intent === 'sin' ? 'sins' : 'good-deeds', locale);
  }, [debounced, themes, intent, locale]);
  const resultCount = filtered.length + themeHits.length;

  // The domain is the group heading or the chosen chip, so a row names only what sets it apart.
  function topicMeta(entry: TopicEntry): string | null {
    const parts: string[] = [];
    if (entry.kabira && kabiraLabel) parts.push(kabiraLabel);
    if (entry.contemporary && contemporaryLabel) parts.push(contemporaryLabel);
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  return (
    <div className="page-width inner-page path-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: pathLabel },
        ]}
      />

      <header className="page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="page-title" tabIndex={-1}>
          {pageTitle}
        </h1>
        <p className="page-lead">{lead}</p>
      </header>

      <section className="catalog-section" aria-label={pathLabel}>
        <form
          className="page-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onQueryChange?.(query);
          }}
        >
          <label className="search-field">
            <Search className="size-[19px]" aria-hidden />
            <input
              ref={inputRef}
              id="topic-search"
              name="q"
              type="search"
              value={query}
              onChange={(event) => onQueryChange?.(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchLabel}
              autoComplete="off"
            />
          </label>
          <button className="solid-button" type="submit">
            {tCatalog('search')} <DirectionalArrow className="size-[18px]" />
          </button>
        </form>

        {chips.length > 0 || hasFlag ? (
          <div className="mb-5 flex flex-col gap-3">
            {chips.length > 0 ? (
              <div
                role="group"
                aria-label={tCatalog('domainsLabel')}
                className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible"
              >
                <FilterChip pressed={!domain} onClick={() => onDomainChange?.(null)}>
                  {tCatalog('allDomains')}
                </FilterChip>
                {chips.map((chip) => (
                  <FilterChip
                    key={chip.key}
                    pressed={domain === chip.key}
                    count={chip.count}
                    disabled={chip.count === 0 && domain !== chip.key}
                    onClick={() => onDomainChange?.(domain === chip.key ? null : chip.key)}
                  >
                    {chip.key === OTHER_DOMAIN ? tCatalog('otherDomain') : domainLabel(chip.key)}
                  </FilterChip>
                ))}
              </div>
            ) : null}
            {hasFlag && flag ? (
              <div>
                <FilterChip pressed={only} onClick={() => onOnlyChange?.(!only)} check>
                  {flag.label}
                </FilterChip>
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="results-count" id="results-count" role="status">
          {tCatalog('results', { count: resultCount })}
        </p>

        {resultCount === 0 ? (
          <p className="empty-state">{noResults || tCatalog('empty')}</p>
        ) : (
          <div className="flex flex-col gap-8" id="topic-results">
            {groups.map((group) =>
              group.entries.length === 0 ? null : (
                <section key={group.key || 'all'} aria-labelledby={group.key ? `group-${group.key}` : undefined}>
                  {group.key ? (
                    <h2 id={`group-${group.key}`} className="catalog-group-title">
                      {domainLabel(group.key)}
                      <span className="catalog-group-count">
                        <FormattedNumber value={group.entries.length} />
                      </span>
                    </h2>
                  ) : null}
                  <div className="topic-list">
                    {group.entries.map((entry) => {
                      const label = arabic ? entry.nameAr : (entry.name || entry.nameAr);
                      const meta = topicMeta(entry);
                      return (
                        <Link key={entry.href} href={entry.href} className="topic-item" {...reach(entry.href)}>
                          <Icon className="size-[26px]" aria-hidden />
                          <span>
                            <strong>
                              {/* شعب الإيمان: the map is the numbered list of the 77 branches (no grouping data exists). */}
                              {intent === 'branch' && entry.taxonomyOrder ? (
                                <>
                                  <FormattedNumber value={entry.taxonomyOrder} />
                                  {' · '}
                                </>
                              ) : null}
                              {label} <LinkPending />
                            </strong>
                            {meta ? <small>{meta}</small> : null}
                            {!meta && entry.quoteCount > 0 ? (
                              // A number with its unit (W-20): «20 نصًا», never a bare «20».
                              <small>{tCatalog('textCount', { count: entry.quoteCount, n: formatDigits(entry.quoteCount) })}</small>
                            ) : null}
                          </span>
                          <DirectionalArrow className="topic-arrow size-[18px]" />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ),
            )}
            {themeHits.length > 0 ? (
              <section aria-labelledby="group-themes">
                <h2 id="group-themes" className="catalog-group-title">
                  {tCatalog('themesGroup')}
                </h2>
                <div className="topic-list">
                  {themeHits.map((hit) => (
                    <Link key={`theme-${hit.key}`} href={hit.href} className="topic-item" {...reach(hit.href)}>
                      <Icon className="size-[26px]" aria-hidden />
                      <span>
                        <strong>{hit.label} <LinkPending /></strong>
                        <small>{tCatalog('themeIn', { title: hit.pageTitle })}</small>
                      </span>
                      <DirectionalArrow className="topic-arrow size-[18px]" />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        <p className="page-footnote">{tCatalog('footnote')}</p>
      </section>
    </div>
  );
}

interface FilterChipProps {
  pressed: boolean;
  count?: number;
  disabled?: boolean;
  /** A switch (on/off) shows a check when on; a chip of a set does not. */
  check?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

/** A bordered toggle pill: filled green when pressed, with the count of what it keeps. */
function FilterChip({ pressed, count, disabled = false, check = false, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="touch-44 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm whitespace-nowrap transition-colors duration-150 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-45 disabled:hover:border-border aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
    >
      {check ? <Check aria-hidden className={pressed ? 'size-4' : 'size-4 opacity-30'} /> : null}
      {children}
      {count !== undefined ? (
        <span className="text-xs tabular-nums opacity-80">
          <FormattedNumber value={count} />
        </span>
      ) : null}
    </button>
  );
}
