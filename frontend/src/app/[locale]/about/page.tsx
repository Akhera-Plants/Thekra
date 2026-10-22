import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { getCatalogSources } from '@/lib/api/sources';
import type { LocaleCode } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

export default async function AboutPage({
  params,
}: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  const sources = await getCatalogSources({ limit: 100, lang: locale as LocaleCode })
    .then((result) => result.data)
    .catch(() => []);
  const books = sources.filter((source) => (locale === 'ar' ? source.nameAr : source.name));

  return (
    <div className="page-width inner-page about-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: tCrumbs('about') },
        ]}
      />

      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>{t('pageTitle')}</h1>
        <p className="page-lead">{t('lead')}</p>
      </header>

      <div className="about-copy">
        <p>{t('intro')}</p>
        <p>{t('openitiBody')}</p>

        <section id="content-methodology" className="content-methodology">
          <h2>{t('methodologyTitle')}</h2>
          <p>{t('methodologyBody')}</p>
        </section>
      </div>

      {books.length > 0 ? (
        <section className="about-copy" aria-label={t('openitiTitle')}>
          <h2>{t('openitiTitle')}</h2>
          <ul>
            {books.map((book) => {
              const title = locale === 'ar' ? book.nameAr : book.name;
              const author = locale === 'ar' ? book.authorAr : book.author;
              return (
                <li key={book.id}>
                  <p>
                    <strong>{title}</strong>
                    {author ? <> — {author}</> : null}
                  </p>
                  <p>
                    <FormattedNumber value={book.quoteCount ?? 0} /> {t('imported')}
                    {' · '}
                    <FormattedNumber value={book.publishedQuoteCount ?? 0} /> {t('published')}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <nav className="about-paths" aria-label={tNav('main')}>
        <Link className="solid-button" href="/sins">
          {tCrumbs('sins')} <DirectionalArrow className="size-[18px]" />
        </Link>
        <Link className="outline-button" href="/good-deeds">
          {tCrumbs('goodDeeds')} <DirectionalArrow className="size-[18px]" />
        </Link>
        <Link className="outline-button" href="/branches">
          {tCrumbs('branches')} <DirectionalArrow className="size-[18px]" />
        </Link>
      </nav>
    </div>
  );
}
