import { setRequestLocale } from 'next-intl/server';
import { ReminderSetsView } from '@/features/curation/components/ReminderSetsView';

export default async function AdminReminderSetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReminderSetsView />;
}
