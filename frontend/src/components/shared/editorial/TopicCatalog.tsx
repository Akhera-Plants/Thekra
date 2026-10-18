'use client';

import { Suspense, useEffect, useMemo, useRef, useState, useTransition, type ComponentType } from 'react';
import { ArrowLeft, BookOpen, DoorOpen, Search, Sprout } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { FormattedNumber } from '@/components/shared/FormattedNumber';

const SEARCH_DEBOUNCE_MS = 300;

const INTENT_ICON: Record<'sin' | 'good-deed' | 'branch', ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  sin: DoorOpen,
  'good-deed': Sprout,
  branch: BookOpen,
};

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

  return (
    <TopicCatalogShell
      {...props}
      query={query}
      debounced={debounced}
      onQueryChange={setQuery}
    />
  );
}

interface ShellProps extends TopicCatalogProps {
  query: string;
  debounced?: string;
  onQueryChange?: (value: string) => void;
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
  query,
  debounced = '',
  onQueryChange,
}: ShellProps) {
  void _pathHref;
  const locale = useLocale();
  const arabic = locale === 'ar';
  const tNav = useTranslations('nav');
  const tCrumbs = useTranslations('breadcrumbs');
  const tCatalog = useTranslations('catalog');
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = INTENT_ICON[intent];

  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) inputRef.current?.focus();
  }, []);

  const domainOrder = useMemo(() => {
    const order = new Map<string, number>();
    TOPIC_DOMAINS.forEach((domain, index) => order.set(domain.key, index));
    return order;
  }, []);

  const filtered = useMemo(() => {
    const needle = debounced.toLowerCase();
    const list = !debounced
      ? entries
      : entries.filter(
          (entry) =>
            entry.nameAr.includes(debounced)
            || (entry.name?.toLowerCase().includes(needle) ?? false),
        );
    return [...list].sort((a, b) => {
      const da = a.domainKey ? (domainOrder.get(a.domainKey) ?? 99) : 99;
      const db = b.domainKey ? (domainOrder.get(b.domainKey) ?? 99) : 99;
      if (da !== db) return da - db;
      return (a.taxonomyOrder ?? 0) - (b.taxonomyOrder ?? 0);
    });
  }, [debounced, domainOrder, entries]);

  function topicMeta(entry: TopicEntry): string | null {
    const parts: string[] = [];
    const domain = TOPIC_DOMAINS.find((item) => item.key === entry.domainKey);
    if (domain) parts.push(arabic ? domain.ar : domain.en);
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
            {tCatalog('search')} <ArrowLeft className="size-[18px] rtl:-scale-x-100" aria-hidden />
          </button>
        </form>

        <p className="results-count" id="results-count" role="status">
          {tCatalog('results', { count: filtered.length })}
        </p>

        {filtered.length === 0 ? (
          <p className="empty-state">{noResults || tCatalog('empty')}</p>
        ) : (
          <div className="topic-list" id="topic-results">
            {filtered.map((entry) => {
              const label = arabic ? entry.nameAr : (entry.name || entry.nameAr);
              const meta = topicMeta(entry);
              return (
                <Link key={entry.href} href={entry.href} className="topic-item">
                  <Icon className="size-[26px]" aria-hidden />
                  <span>
                    <strong>{label}</strong>
                    {meta ? <small>{meta}</small> : null}
                    {!meta && entry.quoteCount > 0 ? (
                      <small>
                        <FormattedNumber value={entry.quoteCount} />
                      </small>
                    ) : null}
                  </span>
                  <ArrowLeft className="topic-arrow size-[18px] rtl:-scale-x-100" aria-hidden />
                </Link>
              );
            })}
          </div>
        )}

        <p className="page-footnote">{tCatalog('footnote')}</p>
      </section>
    </div>
  );
}
