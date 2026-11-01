import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { QuoteCard } from '@/components/shared/quote';
import { MizanBlock, NameWorshipLinks } from '@/features/topic/components/TopicTemplate';
import { getNameOfAllah, getNamesOfAllah } from '@/lib/api/names';
import { rethrowUnlessNotFound } from '@/lib/api/server-guard';
import { reportFailure } from '@/lib/errors';
import { localeAlternates } from '@/lib/seo';

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return (await getNamesOfAllah()).data.map((name) => ({ slug: name.slug }));
  } catch (error) {
    // A failing API at build time prerenders nothing rather than failing the build; pages render on first visit.
    reportFailure('names generateStaticParams', error);
    return [];
  }
}

export async function generateMetadata({ params }: PageProps<'/[locale]/names/[slug]'>): Promise<Metadata> {
  const { slug, locale } = await params;
  try {
    const { data } = await getNameOfAllah(slug, locale);
    return { title: data.nameAr, alternates: localeAlternates(locale, `/names/${data.slug}`), robots: { index: false } };
  } catch {
    return {};
  }
}

/**
 * A Name of Allah on the topic template (redesign §4.7): الميزان = the verse that contains the name (from the API, by
 * id), one line of meaning («قيد المراجعة»), «التعبّد بهذا الاسم» = links to related topics, then the other verses.
 */
export default async function NamePage({ params }: PageProps<'/[locale]/names/[slug]'>) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('names');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');

  let detail: Awaited<ReturnType<typeof getNameOfAllah>>['data'];
  try {
    detail = (await getNameOfAllah(slug, locale)).data;
  } catch (error) {
    rethrowUnlessNotFound('name page', error);
  }
  // English meanings are ours, not from a source (PROJECT_GUIDE content rule 2): show the Arabic until one exists.
  const meaning = detail.meaningAr;

  return (
    <div className="page-width inner-page topic-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: tCrumbs('names'), href: '/names' },
          { label: detail.nameAr },
        ]}
      />

      <article className="flex min-w-0 flex-1 flex-col gap-10">
        <header className="page-heading">
          <p className="eyebrow">{t('number', { number: String(detail.number) })}</p>
          <h1 id="page-title" tabIndex={-1} lang="ar" dir="rtl" className="font-arabic-display">
            {detail.nameAr}
          </h1>
        </header>

        {detail.verse ? (
          <MizanBlock mizan={{ source: 'curated', items: [detail.verse] }} intent="good-deed" lead={t('verseLead')} />
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">{t('verseMissing')}</p>
        )}

        <section aria-labelledby="name-meaning-title" className="flex flex-col gap-2">
          <h2 id="name-meaning-title" className="text-xl font-medium">
            {t('meaningTitle')}
          </h2>
          <p className="text-lg leading-8" lang={locale === 'en' ? 'en' : 'ar'}>
            {meaning}{' '}
            {detail.review === 'pending-sheikh' ? (
              <span className="text-xs text-muted-foreground">({t('pendingReview')})</span>
            ) : null}
          </p>
        </section>

        <NameWorshipLinks links={detail.links} />

        {detail.otherVerses.length > 0 ? (
          <section aria-labelledby="name-verses-title" className="flex flex-col gap-3">
            <h2 id="name-verses-title" className="text-xl font-medium">
              {t('otherVersesTitle')}
            </h2>
            <ul className="flex flex-col gap-4">
              {detail.otherVerses.map((quote) => (
                <li key={quote.id}>
                  <QuoteCard quote={quote} density="compact" intent="good-deed" detailHref={`/quotes/${quote.id}`} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav className="reader-end" aria-label={tCrumbs('names')}>
          {detail.prev ? (
            <Link href={`/names/${detail.prev.slug}`} className="outline-button">
              <span lang="ar">{detail.prev.nameAr}</span>
            </Link>
          ) : (
            <Link href="/names" className="outline-button">
              {tCrumbs('names')}
            </Link>
          )}
          {detail.next ? (
            <Link href={`/names/${detail.next.slug}`} className="solid-button">
              <span lang="ar">{detail.next.nameAr}</span>{' '}
              <span className="text-xs opacity-80">
                <FormattedNumber value={detail.next.number} />
              </span>
            </Link>
          ) : null}
        </nav>
      </article>
    </div>
  );
}
