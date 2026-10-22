import { setRequestLocale } from 'next-intl/server';
import { TagCrudView } from '@/features/curation/components/TagCrudView';

export default async function AdminTagsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TagCrudView />;
}
