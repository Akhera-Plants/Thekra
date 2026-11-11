import { setRequestLocale } from 'next-intl/server';
import { CircleReportsView } from '@/features/curation/components/circle-reports/CircleReportsView';

export default async function AdminCircleReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CircleReportsView />;
}
