import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
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

      <section id="philosophy" className="about-copy" aria-labelledby="philosophy-title">
        <h2 id="philosophy-title">{t('philosophyTitle')}</h2>
        {verse ? (
          <figure>
            <blockquote lang="ar" dir="rtl" className="font-quran text-2xl leading-[2.1]">
              ﴿{verse.textAr}﴾
            </blockquote>
            {verseEnglish ? <p>{verseEnglish}</p> : null}
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
        ) : null}
        <p>{t('philosophyLead')}</p>
        <ol className="list-decimal ps-6">
          {conditions.map((key) => (
            <li key={key}>
              <strong>{t(`conditions.${key}.title`)}</strong> — {t(`conditions.${key}.line`)}
            </li>
          ))}
        </ol>
      </section>

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
                  {/* Visitors see what they can read, with its unit; the imported/published counts are internal (W-20). */}
                  {(book.publishedQuoteCount ?? 0) > 0 ? (
                    <p>{t('publishedTexts', { count: book.publishedQuoteCount ?? 0, n: formatDigits(book.publishedQuoteCount ?? 0) })}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
