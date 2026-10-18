import { setRequestLocale, getTranslations } from 'next-intl/server';
import { TopicCatalog, type TopicEntry } from '@/components/shared/editorial/TopicCatalog';
import { getBranches } from '@/lib/api/branches';

export const dynamic = 'force-dynamic';

export default async function BranchesPage({
  params,
}: PageProps<'/[locale]/branches'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('branches');
  const tHome = await getTranslations('home');
  const tCrumbs = await getTranslations('breadcrumbs');

  let branches: Awaited<ReturnType<typeof getBranches>>['data'] = [];
  try {
    branches = (await getBranches({ limit: 100, lang: locale })).data;
  } catch {
    branches = [];
  }

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
