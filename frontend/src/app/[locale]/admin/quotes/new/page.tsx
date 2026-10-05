import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { QuoteForm } from '@/features/curation/components/QuoteForm';

export default async function AdminQuoteNewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('quotes.newQuote')}</h1>
      <QuoteForm />
    </div>
  );
}
