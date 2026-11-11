import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ChevronDown } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { reportFailure } from '@/lib/errors';
import { getCatalogSources } from '@/lib/api/sources';
import { getAyah } from '@/lib/api/quran';
import { formatDigits } from '@/lib/format/digits';
import type { LocaleCode } from '@/lib/types/enums';
import { localeAlternates } from '@/lib/seo';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/about'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return { title: t('pageTitle'), alternates: localeAlternates(locale, '/about') };
}

export default async function AboutPage({
  params,
}: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  const tHome = await getTranslations('home');
  const sources = await getCatalogSources({ limit: 100, lang: locale as LocaleCode })
    .then((result) => result.data)
    .catch((error: unknown) => {
      // Optional list of source books: the page reads fine without it.
      reportFailure('about sources', error);
      return [];
    });
  // Qaf 50:37 as stored (content rule §3.1); the philosophy reads fine without it.
  const verse = await getAyah(50, 37, { lang: locale as LocaleCode })
    .then((result) => result.data)
    .catch((error: unknown) => {
      reportFailure('about verse', error);
      return null;
    });
  const surah = verse?.quran ? (locale === 'ar' ? verse.quran.surahNameAr : verse.quran.surahName) : null;
  const verseEnglish = locale === 'en' ? (verse?.translation?.text?.trim() ?? null) : null;
  const conditions = ['remembrance', 'heart', 'listening', 'presence'] as const;
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

      {/* Round 6 (C-21): the reference's short page — one reading column, a statement first, then short sections
          parted by hairlines; the list of books folds. Our content, unchanged. */}
      <div className="about-column">
        <section id="philosophy" aria-labelledby="philosophy-title" className="about-block">
          <p className="text-sm text-muted-foreground">{t('philosophyTitle')}</p>
          {verse ? (
            <figure className="flex flex-col gap-2">
              <blockquote id="philosophy-title" lang="ar" dir="rtl" className="font-quran text-[28px] leading-[2] md:text-[34px]">
                ﴿{verse.textAr}﴾
              </blockquote>
              {verseEnglish ? <p className="text-lg leading-8">{verseEnglish}</p> : null}
              {surah && verse.quran?.ayahNumber != null ? (
                <figcaption className="text-sm text-muted-foreground">
                  {tHome('verseCitation', {
                    surah,
                    chapter: formatDigits(verse.quran.surahNumber ?? 50),
                    ayah: formatDigits(verse.quran.ayahNumber),
                  })}
                </figcaption>
              ) : null}
            </figure>
          ) : (
            <h2 id="philosophy-title" className="text-3xl font-medium">
              {t('philosophyTitle')}
            </h2>
          )}
          <p className="about-text">{t('philosophyLead')}</p>
          <ol className="flex flex-col gap-2 ps-6 [list-style:decimal]">
            {conditions.map((key) => (
              <li key={key} className="about-text">
                <strong className="font-medium">{t(`conditions.${key}.title`)}</strong> — {t(`conditions.${key}.line`)}
              </li>
            ))}
          </ol>
        </section>

        <section id="content-methodology" aria-labelledby="methodology-title" className="about-block">
          <h2 id="methodology-title" className="text-2xl font-medium">
            {t('methodologyTitle')}
          </h2>
          <p className="about-text">{t('intro')}</p>
          <p className="about-text">{t('methodologyBody')}</p>
        </section>

        <section aria-labelledby="openiti-title" className="about-block">
          <h2 id="openiti-title" className="text-2xl font-medium">
            {t('openitiTitle')}
          </h2>
          <p className="about-text">{t('openitiBody')}</p>
          {books.length > 0 ? (
            <details className="group">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-medium text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                {t('booksToggle', { n: formatDigits(books.length) })}
              </summary>
              <ul className="flex flex-col divide-y divide-border pt-2">
                {books.map((book) => {
                  const title = locale === 'ar' ? book.nameAr : book.name;
                  const author = locale === 'ar' ? book.authorAr : book.author;
                  return (
                    <li key={book.id} className="flex flex-col gap-0.5 py-3">
                      <p>
                        <strong className="font-medium">{title}</strong>
                        {author ? <span className="text-muted-foreground"> — {author}</span> : null}
                      </p>
                      {/* Visitors see what they can read, with its unit; the imported/published counts are internal (W-20). */}
                      {(book.publishedQuoteCount ?? 0) > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t('publishedTexts', { count: book.publishedQuoteCount ?? 0, n: formatDigits(book.publishedQuoteCount ?? 0) })}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
        </section>
      </div>

      <nav className="about-paths" aria-label={t("pathsNav")}>
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
