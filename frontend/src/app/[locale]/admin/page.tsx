import { setRequestLocale } from 'next-intl/server';
import { DashboardView } from '@/features/curation/components/DashboardView';

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DashboardView />;
}
