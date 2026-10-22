import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { getQuote } from '@/lib/api/quotes';
import type { LocaleCode } from '@/lib/types/enums';
import { QuoteDetail } from '@/features/quran-hadith-browser/components/QuoteDetail';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/quotes/[id]'>) {
  const { id, locale } = await params;
  try {
    const { data } = await getQuote(id, {
      lang: locale as LocaleCode,
    });
    return { title: `${data.textAr.slice(0, 60)}… — ذكرى` };
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
  } catch {
    notFound();
  }

  const arabic = locale === 'ar';
  const relatedSin = quote?.relatedSins?.[0];
  const relatedDeed = quote?.relatedGoodDeeds?.[0];
  const crumbTitle = quote
    ? (quote.textAr.slice(0, 42) + (quote.textAr.length > 42 ? '…' : ''))
    : t('pageTitle');

  const crumbItems = [
    { label: tCrumbs('home'), href: '/' as const },
    ...(relatedSin
      ? [
          { label: tCrumbs('sins'), href: '/sins' as const },
          {
            label: arabic || !relatedSin.name ? relatedSin.nameAr : relatedSin.name,
            href: `/sins/${relatedSin.slug}` as const,
          },
        ]
      : relatedDeed
        ? [
            { label: tCrumbs('goodDeeds'), href: '/good-deeds' as const },
            {
              label: arabic || !relatedDeed.name ? relatedDeed.nameAr : relatedDeed.name,
              href: `/good-deeds/${relatedDeed.slug}` as const,
            },
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
