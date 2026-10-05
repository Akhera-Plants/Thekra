import { setRequestLocale } from 'next-intl/server';
import { QuoteDetailAdminView } from '@/features/curation/components/QuoteDetailAdminView';

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <QuoteDetailAdminView quoteId={id} />;
}
