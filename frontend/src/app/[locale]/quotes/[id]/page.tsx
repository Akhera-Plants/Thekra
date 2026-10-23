import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { getQuote } from '@/lib/api/quotes';
import { rethrowUnlessNotFound } from '@/lib/api/server-guard';
import type { LocaleCode } from '@/lib/types/enums';
import { QuoteDetail } from '@/features/quran-hadith-browser/components/QuoteDetail';

// Cached and revalidated like the topic pages; ids render on first visit.
export const revalidate = 300;

/** A short, whole-word lead of a text for crumbs and titles. */
function excerpt(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s،,.:;]+$/, '')}…`;
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/quotes/[id]'>): Promise<Metadata> {
  const { id, locale } = await params;
  try {
    const { data } = await getQuote(id, {
      lang: locale as LocaleCode,
    });
    // The tab title follows the page language too: no Arabic text as the English title.
    const text = locale === 'en' ? data.translation?.text : data.textAr;
    if (!text) {
      const t = await getTranslations({ locale, namespace: 'quoteDetail' });
      return { title: t('pageTitle') };
    }
    return { title: excerpt(text, 60) };
  } catch {
    return {};
  }
}

export default async function QuoteDetailPage({
  params,
}: PageProps<'/[locale]/quotes/[id]'>) {
  const { id, locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('quoteDetail');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');

  let quote: Awaited<ReturnType<typeof getQuote>>['data'] | null = null;
  try {
    const result = await getQuote(id, {
      lang: locale as LocaleCode,
      includeAllTranslations: true,
    });
    quote = result.data;
  } catch (error) {
    rethrowUnlessNotFound('quote page', error);
  }

  const arabic = locale === 'ar';
  const relatedSin = quote?.relatedSins?.[0];
  const relatedDeed = quote?.relatedGoodDeeds?.[0];
  // Each crumb is in the page's language: the Arabic text on /, the English translation on /en
  // (or the page title when the text has none). Topic names use the catalogue's English name.
  const crumbSource = arabic ? quote?.textAr : quote?.translation?.text;
  const crumbTitle = crumbSource ? excerpt(crumbSource, arabic ? 42 : 48) : t('pageTitle');
  const sinName = relatedSin ? (arabic ? relatedSin.nameAr : relatedSin.name) : null;
  const deedName = relatedDeed ? (arabic ? relatedDeed.nameAr : relatedDeed.name) : null;

  const crumbItems = [
    { label: tCrumbs('home'), href: '/' as const },
    ...(relatedSin
      ? [
          { label: tCrumbs('sins'), href: '/sins' as const },
          ...(sinName ? [{ label: sinName, href: `/sins/${relatedSin.slug}` as const }] : []),
        ]
      : relatedDeed
        ? [
            { label: tCrumbs('goodDeeds'), href: '/good-deeds' as const },
            ...(deedName ? [{ label: deedName, href: `/good-deeds/${relatedDeed.slug}` as const }] : []),
          ]
        : []),
    { label: crumbTitle },
  ];

  return (
    <div className="page-width inner-page quote-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={crumbItems} />

      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1} className="sr-only">{t('pageTitle')}</h1>
      </header>

      <div className="single-reading reading-sheet">
        {quote && <QuoteDetail quote={quote} />}
      </div>
    </div>
  );
}
