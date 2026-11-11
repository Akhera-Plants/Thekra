import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { getQuote } from '@/lib/api/quotes';
import { rethrowUnlessNotFound } from '@/lib/api/server-guard';
import type { LocaleCode } from '@/lib/types/enums';
import { QuoteDetail } from '@/features/quran-hadith-browser/components/QuoteDetail';
import { localeAlternates, metaDescription } from '@/lib/seo';
import { englishProvenance } from '@/lib/format/provenance';

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
    // The tab title follows the page language too: no Arabic text as the English title. It names the source
    // («الحجرات 49:11», «صحيح البخاري، رقم 6018»), not the start of the text (W-18).
    const text = locale === 'en' ? data.translation?.text : data.textAr;
    const t = await getTranslations({ locale, namespace: 'quoteDetail' });
    const title = quoteSourceTitle(data, locale === 'en' ? 'en' : 'ar') ?? t('pageTitle');
    return {
      title,
      description: text ? metaDescription(text) : undefined,
      alternates: localeAlternates(locale, `/quotes/${id}`),
    };
  } catch {
    return {};
  }
}

/** «الحجرات 49:11» / "Al-Hujurat 49:11", or the hadith reference in the page language; null when none fits. */
function quoteSourceTitle(
  quote: Awaited<ReturnType<typeof getQuote>>['data'],
  locale: 'ar' | 'en',
): string | null {
  if (quote.quran?.surahNumber && quote.quran.ayahNumber) {
    const name = locale === 'en' ? (quote.quran.surahName || null) : quote.quran.surahNameAr;
    const ref = `${quote.quran.surahNumber}:${quote.quran.ayahNumber}`;
    return name ? `${name} ${ref}` : ref;
  }
  const reference = quote.hadith?.reference?.trim();
  if (reference) {
    if (locale === 'ar') return /[A-Za-z]/.test(reference) ? null : reference;
    return englishProvenance(reference);
  }
  const source = locale === 'en' ? quote.source.name : quote.source.nameAr;
  if (!source || (locale === 'ar' && /[A-Za-z]/.test(source)) || (locale === 'en' && /[\u0600-\u06FF]/.test(source))) return null;
  return source;
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
  const crumbTitle =
    (quote ? quoteSourceTitle(quote, arabic ? 'ar' : 'en') : null)
    ?? (crumbSource ? excerpt(crumbSource, arabic ? 42 : 48) : t('pageTitle'));
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
