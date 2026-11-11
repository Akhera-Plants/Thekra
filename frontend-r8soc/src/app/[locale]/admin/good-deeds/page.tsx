import { setRequestLocale } from 'next-intl/server';
import { GoodDeedCrudView } from '@/features/curation/components/GoodDeedCrudView';

export default async function AdminGoodDeedsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GoodDeedCrudView />;
}
