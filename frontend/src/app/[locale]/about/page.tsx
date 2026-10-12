import { setRequestLocale, getTranslations } from 'next-intl/server';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { getCatalogSources } from '@/lib/api/sources';
import type { LocaleCode } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

export default async function AboutPage({
  params,
}: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const sources = await getCatalogSources({ limit: 100, lang: locale as LocaleCode })
    .then((result) => result.data)
    .catch(() => []);
  const books = sources.filter((source) => (locale === 'ar' ? source.nameAr : source.name));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-10">
      <header className="flex max-w-prose flex-col gap-3">
        <h1 className="font-arabic-display text-3xl md:text-4xl">{t('pageTitle')}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{t('intro')}</p>
      </header>

      {books.length > 0 ? (
        <ul className="flex flex-col">
          {books.map((book) => {
            const title = locale === 'ar' ? book.nameAr : book.name;
            const author = locale === 'ar' ? book.authorAr : book.author;
            return (
              <li key={book.id} className="flex items-baseline justify-between gap-4 border-b border-border py-4">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-arabic-display text-xl">{title}</span>
                  {author ? <span className="text-sm text-muted-foreground">{author}</span> : null}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  <FormattedNumber value={book.publishedQuoteCount ?? 0} /> {t('texts')}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <section className="flex max-w-prose flex-col gap-2">
        <h2 className="font-arabic-display text-xl">{t('openitiTitle')}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('openitiBody')}</p>
      </section>
    </div>
  );
}
