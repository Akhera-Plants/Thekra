import { setRequestLocale } from 'next-intl/server';
import { LinkingWorkspace } from '@/features/curation/components/LinkingWorkspace';

export default async function AdminLinkingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LinkingWorkspace />;
}
