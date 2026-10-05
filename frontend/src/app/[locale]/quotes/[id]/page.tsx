import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
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
    // Use first 60 chars of Arabic text for the title
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <h1 className="sr-only">{t('pageTitle')}</h1>
      {quote && <QuoteDetail quote={quote} />}
    </div>
  );
}
