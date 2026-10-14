import { setRequestLocale, getTranslations } from 'next-intl/server';
import { TopicCatalog, type TopicEntry } from '@/components/shared/editorial/TopicCatalog';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import type { LocaleCode } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

export default async function GoodDeedsPage({ params }: PageProps<'/[locale]/good-deeds'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('goodDeeds');

  let deeds: Awaited<ReturnType<typeof getGoodDeeds>>['data'] = [];
  try {
    for (let page = 1; page <= 20; page += 1) {
      const batch = (await getGoodDeeds({
        page,
        limit: 100,
        lang: locale as LocaleCode,
      })).data;
      deeds.push(...batch);
      if (batch.length < 100) break;
    }
  } catch {
    deeds = [];
  }

  const entries: TopicEntry[] = deeds.map((deed) => ({
    href: `/good-deeds/${deed.slug}`,
    nameAr: deed.nameAr,
    quoteCount: deed.quoteCount,
    domainKey: deed.domainKey ?? null,
    taxonomyOrder: deed.taxonomyOrder ?? null,
    kabira: false,
    contemporary: deed.isContemporary === true,
  }));

  return (
    <TopicCatalog
      entries={entries}
      intent="good-deed"
      pageTitle={t('pageTitle')}
      searchPlaceholder={t('searchPlaceholder')}
      searchLabel={t('searchPlaceholder')}
      noResults={t('noResults')}
      kabiraLabel=""
      contemporaryLabel={t('contemporary')}
    />
  );
}
