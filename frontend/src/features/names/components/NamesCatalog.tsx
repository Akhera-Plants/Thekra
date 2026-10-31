'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import type { NameOfAllahDto } from '@/lib/api/names';
import { foldArabic } from '@/lib/search/topic-themes';

/** Folded without «ال», so «رحمن», «الرحمن» and «ٱلرَّحْمَٰن» all find the same name. */
function key(value: string): string {
  return foldArabic(value).replace(/^ال/, '');
}

/**
 * «الأسماء الحسنى» list (redesign §4.7): a search box and numbered cards, the name in the Arabic display face. The search
 * matches the Arabic name (tashkeel, hamza seats and «ال» ignored) or its transliterated slug.
 */
export function NamesCatalog({ names }: { names: readonly NameOfAllahDto[] }) {
  const t = useTranslations('names');
  const tCatalog = useTranslations('catalog');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = key(query.trim());
    const latin = query.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (!needle && !latin) return names;
    return names.filter(
      (name) => (needle && key(name.nameAr).includes(needle)) || (latin && name.slug.replace(/-/g, '').includes(latin)),
    );
  }, [names, query]);

  return (
    <section className="catalog-section" aria-label={t('pageTitle')}>
      <form className="page-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="search-field">
          <Search className="size-[19px]" aria-hidden />
          <input
            id="names-search"
            name="q"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            autoComplete="off"
          />
        </label>
      </form>

      <p className="results-count" role="status">
        {tCatalog('results', { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <p className="empty-state">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((name) => (
            <li key={name.slug}>
              <Link
                href={`/names/${name.slug}`}
                prefetch={false}
                className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card px-3 py-4 text-center transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="text-xs text-muted-foreground">
                  <FormattedNumber value={name.number} />
                </span>
                <span lang="ar" dir="rtl" className="font-arabic-display text-3xl leading-[1.6] text-intent-good-deed">
                  {name.nameAr}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
