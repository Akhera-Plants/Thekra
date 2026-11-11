import { setRequestLocale } from 'next-intl/server';
import { SinCrudView } from '@/features/curation/components/SinCrudView';

export default async function AdminSinsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SinCrudView />;
}
