import { setRequestLocale } from 'next-intl/server';
import { SourceCrudView } from '@/features/curation/components/SourceCrudView';

export default async function AdminSourcesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SourceCrudView />;
}
