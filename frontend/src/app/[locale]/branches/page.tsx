import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { TopicCatalog, type TopicEntry } from '@/components/shared/editorial/TopicCatalog';
import { reportFailure } from '@/lib/errors';
import { getBranches } from '@/lib/api/branches';
import { localeAlternates } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/branches'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'branches' });
  return { title: t('pageTitle'), alternates: localeAlternates(locale, '/branches') };
}

export default async function BranchesPage({
  params,
}: PageProps<'/[locale]/branches'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('branches');
  const tHome = await getTranslations('home');
  const tCrumbs = await getTranslations('breadcrumbs');

  // The list is the page: error.tsx with a retry, not a cached empty catalogue.
  const branches = (
    await getBranches({ limit: 100, lang: locale }).catch((error: unknown) => {
      reportFailure('branches catalogue', error);
      throw error;
    })
  ).data;

  const entries: TopicEntry[] = branches.map((branch) => ({
    href: `/branches/${branch.number}`,
    nameAr: branch.titleAr,
    name: branch.title || t('branchFallback', { number: branch.number }),
    quoteCount: branch.quoteCount,
    domainKey: null,
    taxonomyOrder: branch.number,
    kabira: false,
    contemporary: false,
  }));

  return (
    <TopicCatalog
      entries={entries}
      intent="branch"
      pageTitle={t('pageTitle')}
      eyebrow={tHome('branchOverline')}
      lead={tHome('branchEntryDescription')}
      pathHref="/branches"
      pathLabel={tCrumbs('branches')}
      searchPlaceholder={t('searchPlaceholder')}
      searchLabel={t('searchPlaceholder')}
      noResults={t('empty')}
    />
  );
}
