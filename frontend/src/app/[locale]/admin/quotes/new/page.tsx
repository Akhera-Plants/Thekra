import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { QuoteForm } from '@/features/curation/components/QuoteForm';
import { PageHeader } from '@/features/curation/components/kit/PageHeader';

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
      <PageHeader title={t('quotes.newQuote')} />
      <QuoteForm />
    </div>
  );
}
