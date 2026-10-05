import { setRequestLocale } from 'next-intl/server';
import { SyncConsoleView } from '@/features/curation/components/SyncConsoleView';

export default async function AdminSyncPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SyncConsoleView />;
}
