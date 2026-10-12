import { setRequestLocale } from 'next-intl/server';
import { FlagsQueue } from '@/features/curation/components/FlagsQueue';

export default async function AdminFlagsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FlagsQueue />;
}
